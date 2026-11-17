import { flushAllPendingWrites } from './pendingWrites';

/**
 * Recovery from chunk load errors: after a release, a tab running old code may request a lazy
 * chunk (builder, library, dates, dictionaries) that no longer exists (404 on GitHub Pages).
 * First reaction: one automatic reload (after saving and activating a waiting new worker).
 * If it fails again right after that reload, the error view offers "Reset app".
 *
 * Reload-loop guard: a timestamp in `history.state` of the current entry. It survives
 * `location.reload()` (session history keeps the entry's state), is per tab, invisible in the URL
 * and needs no storage (localStorage/sessionStorage are not allowed). React Router keeps unknown
 * keys of the entry it starts on. A navigation can push a new entry (without the marker) between
 * the failure and the reload, so the marker is set again on the then-current entry right before
 * reloading: the guard covers "reload -> same failure" with at most one automatic reload. The
 * timestamp makes an old
 * marker (e.g. from a release weeks ago, on a restored tab) harmless.
 */

export const RELOAD_MARKER = 'bogenChunkReload';
/** A failure within this time after the automatic reload counts as "the reload did not help". */
const RELOAD_WINDOW_MS = 60_000;
/** Saving and activating the new worker may take at most this long before reloading anyway. */
const PREPARE_TIMEOUT_MS = 5_000;

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i, // Chromium
  /error loading dynamically imported module/i, // Firefox
  /Importing a module script failed/i, // Safari
  /Unable to preload CSS/i, // Vite preload helper
];

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(error.message));
}

export const reloadPage = () => window.location.reload();

/** URL of the own service worker scope (the Vite base), e.g. `https://user.github.io/bogen/`. */
export function ownScope(): string {
  return new URL(import.meta.env.BASE_URL, window.location.href).href;
}

interface RecoveryDeps {
  reload?: () => void;
  /** Work before the reload; default: save answers, activate a waiting new worker. */
  prepare?: () => Promise<void>;
  now?: () => number;
}

function markerTime(): number | undefined {
  const state: unknown = window.history.state;
  if (state && typeof state === 'object' && RELOAD_MARKER in state) {
    const value = (state as Record<string, unknown>)[RELOAD_MARKER];
    if (typeof value === 'number') return value;
  }
  return undefined;
}

function setMarker(value: number | undefined) {
  const state: unknown = window.history.state;
  const next: Record<string, unknown> = state && typeof state === 'object' ? { ...state } : {};
  if (value === undefined) delete next[RELOAD_MARKER];
  else next[RELOAD_MARKER] = value;
  window.history.replaceState(next, '');
}

/** Dependencies set by `installChunkErrorRecovery` (tests inject fakes there). */
let defaultDeps: RecoveryDeps = {};
/** A recovery reload is underway in this document: every further failure just waits for it. */
let scheduled = false;

export function isReloadScheduled(): boolean {
  return scheduled;
}

/** Forgets the scheduled reload and the injected dependencies (tests: "a new document"). */
export function resetChunkRecovery(): void {
  scheduled = false;
  defaultDeps = {};
}

/**
 * Starts the one automatic reload, unless this entry was just reloaded for the same reason.
 * Returns `true` if a reload is underway (the caller shows nothing, also for every further error
 * until the page is gone), `false` if the error view should be shown.
 */
export function recoverFromChunkError(deps: RecoveryDeps = defaultDeps): boolean {
  const { reload = reloadPage, prepare = prepareReload, now = Date.now } = deps;
  if (scheduled) return true;
  const last = markerTime();
  const time = now();
  if (last !== undefined && time - last >= 0 && time - last < RELOAD_WINDOW_MS) return false;
  setMarker(time);
  scheduled = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => (timer = setTimeout(resolve, PREPARE_TIMEOUT_MS)));
  const prepared = prepare().catch((error: unknown) => {
    console.warn('Preparing the reload failed, reloading anyway', error);
  });
  void Promise.race([prepared, timeout]).then(() => {
    clearTimeout(timer);
    // A failed navigation to a lazy route may have pushed a new history entry (without the
    // marker) since: mark the entry that is current now, which is the one the reload restores.
    // Otherwise the same failure after the reload would reload a second time.
    setMarker(time);
    reload();
  });
  return true;
}

/** Default preparation: save pending answers, then fetch and activate a new worker if there is one. */
async function prepareReload(): Promise<void> {
  await flushAllPendingWrites();
  const container = 'serviceWorker' in navigator ? navigator.serviceWorker : undefined;
  if (!container) return;
  const registration = await container.getRegistration(ownScope());
  if (registration?.scope !== ownScope()) return;
  await registration.update().catch(() => {});
  const waiting = registration.waiting;
  if (!waiting) return;
  await new Promise<void>((resolve) => {
    container.addEventListener('controllerchange', () => resolve(), { once: true });
    waiting.postMessage({ type: 'SKIP_WAITING' }); // Workbox generateSW handles this message
  });
}

/**
 * Vite's preload helper (`import().catch(handler)`) dispatches `vite:preloadError` for a failing
 * lazy chunk or one of its dependencies. We start the recovery reload right there, also for
 * imports whose caller swallows the error (e.g. the dictionary fallback at boot).
 *
 * Deliberately no `preventDefault()`: with it, Vite's helper resolves the import to `undefined`,
 * so callers like `(await import('./X')).X` fail with an unrelated TypeError and show an error
 * view before the reload. Without it, the real chunk error reaches the caller; the route error
 * view and the boot path see `isReloadScheduled()` and render nothing until the reload.
 * Also sets the dependencies every later `recoverFromChunkError()` call uses. Returns the
 * uninstall function.
 */
export function installChunkErrorRecovery(target: Window, deps: RecoveryDeps = {}): () => void {
  defaultDeps = deps;
  const onPreloadError = () => {
    recoverFromChunkError();
  };
  target.addEventListener('vite:preloadError', onPreloadError);
  return () => {
    target.removeEventListener('vite:preloadError', onPreloadError);
    defaultDeps = {};
  };
}

/**
 * "Reset app" removes the cached app and the worker and then reloads: offline, that reload would
 * find nothing, so the reset is only offered online (the data in IndexedDB is safe either way).
 */
export function isOnline(): boolean {
  return navigator.onLine !== false;
}

/** Calls `onChange` on every online/offline switch; returns the unsubscribe function. */
export function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

interface CacheStorageLike {
  keys(): Promise<string[]>;
  delete(name: string): Promise<boolean>;
}

interface RegistrationLike {
  scope: string;
  unregister(): Promise<boolean>;
}

interface ServiceWorkerContainerLike {
  getRegistration(clientURL?: string): Promise<RegistrationLike | undefined>;
}

interface ResetDeps {
  caches?: CacheStorageLike;
  serviceWorker?: ServiceWorkerContainerLike;
  scope?: string;
  reload?: () => void;
}

/**
 * "Reset app": deletes only this app's Workbox caches (name ends with the own scope, e.g.
 * `workbox-precache-v2-https://user.github.io/bogen/`) and unregisters only the own worker, then
 * reloads. The origin `*.github.io` is shared with other Pages projects, so nothing broader is
 * touched. IndexedDB (forms, entries, settings) is never deleted.
 */
export async function resetApp({
  caches = typeof window.caches === 'undefined' ? undefined : window.caches,
  serviceWorker = 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
  scope = ownScope(),
  reload = reloadPage,
}: ResetDeps = {}): Promise<void> {
  try {
    if (caches) {
      const own = (await caches.keys()).filter(
        (name) => name.startsWith('workbox-') && name.endsWith(`-${scope}`),
      );
      await Promise.all(own.map((name) => caches.delete(name)));
    }
    const registration = await serviceWorker?.getRegistration(scope);
    // getRegistration() may return a worker of another project with a wider scope: skip that.
    if (registration?.scope === scope) await registration.unregister();
  } catch (error) {
    console.warn('Reset incomplete', error);
  }
  setMarker(undefined);
  reload();
}
