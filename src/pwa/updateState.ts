import { useSyncExternalStore } from 'react';
import { reloadPage } from './chunkErrorRecovery';
import { flushAllPendingWrites, hasUnsavedWork } from './pendingWrites';

/**
 * Shared "a new app version is waiting" state plus the actions around it. `UpdatePrompt` (the
 * only `useRegisterSW` caller) feeds it; the notification, the header indicator and the About
 * page read it, so the update stays reachable after the notification was closed.
 */

type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;
interface Registration {
  readonly installing: ServiceWorker | null;
  readonly waiting: ServiceWorker | null;
  readonly active?: ServiceWorker | null;
  update(): Promise<unknown>;
}

interface Updater {
  updateServiceWorker?: UpdateServiceWorker;
  registration?: Registration;
}

/** Longest wait for pending autosaves before an update; then the person decides (no silent loss). */
export const SAVE_TIMEOUT_MS = 10_000;

/**
 * Why an update did not go ahead: saving failed, it did not finish within SAVE_TIMEOUT_MS, or
 * this tab holds unsaved builder changes (they cannot be saved automatically).
 */
export type UpdateProblem = 'failed' | 'timeout' | 'unsaved' | 'notActivated';

/** Without activation or reload this long after the click, the person is told (and may reload). */
export const ACTIVATION_TIMEOUT_MS = 10_000;
/** After activation, how long the plugin's own reload (`handleNeedReload`) gets before we reload. */
export const RELOAD_GRACE_MS = 3_000;
/** A reload that has not replaced the page after this long was cancelled (e.g. beforeunload prompt). */
export const RELOAD_RELEASE_MS = 5_000;

const updater: Updater = {};
/** A new worker is installed and waiting for activation. */
let waiting = false;
/** The new worker already controls the page, but the reload was held back (saving failed). */
let reloadPending = false;
/** The person chose "reload anyway": the next `handleNeedReload` does not wait for saving again. */
let skipSave = false;
let problem: UpdateProblem | null = null;
/** A reload was started, or `handleNeedReload` is saving right now and will reload (no second one). */
let reloadClaimed = false;
let stopWatching: (() => void) | undefined;
/** An activation watch is running (a second click must not replace it with an empty one). */
let watchActive = false;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getAvailable = () => waiting || reloadPending;
const getProblem = () => problem;

function setProblem(value: UpdateProblem | null) {
  if (problem === value) return;
  problem = value;
  emit();
}

/** Saves all pending answers, but waits at most SAVE_TIMEOUT_MS. */
async function save(): Promise<'saved' | UpdateProblem> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), SAVE_TIMEOUT_MS);
  });
  const saved = flushAllPendingWrites().then((ok): 'saved' | 'failed' => (ok ? 'saved' : 'failed'));
  try {
    return await Promise.race([saved, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Stores the plugin's `updateServiceWorker` and/or the registration (keys given as `undefined` are cleared). */
export function connectUpdater(next: Updater): void {
  Object.assign(updater, next);
}

export function setUpdateWaiting(value: boolean): void {
  if (waiting === value) return;
  waiting = value;
  emit();
}

/** `true` while an update is waiting or a reload for an activated update is still pending. */
export function useUpdateAvailable(): boolean {
  return useSyncExternalStore(subscribe, getAvailable, getAvailable);
}

/** Why the last update attempt stopped (shown as a notification), or `null`. */
export function useUpdateProblem(): UpdateProblem | null {
  return useSyncExternalStore(subscribe, getProblem, getProblem);
}

export function dismissUpdateProblem(): void {
  setProblem(null);
}

/** Back to the initial state (tests). */
export function resetUpdateState(): void {
  waiting = false;
  reloadPending = false;
  skipSave = false;
  problem = null;
  reloadClaimed = false;
  stopWatching?.();
  clearTimeout(releaseTimer);
  connectUpdater({ updateServiceWorker: undefined, registration: undefined });
  emit();
}

/**
 * Safety net after skip-waiting: the plugin only reloads (via `handleNeedReload`) if the page was
 * controlled when it loaded. So watch the worker that was waiting: once it is activated (or gone)
 * and no reload started within a grace period (at once if the page has no controller), reload
 * here. Answers are saved before this runs. Without activation or reload after
 * ACTIVATION_TIMEOUT_MS the person is told; nothing reloads automatically then.
 */
function watchActivation(worker: ServiceWorker | null, reload: () => void): void {
  stopWatching?.();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let done = false;
  const stop = () => {
    done = true;
    watchActive = false;
    timers.forEach(clearTimeout);
    timers.clear();
    worker?.removeEventListener('statechange', onState);
  };
  const reloadOnce = () => {
    if (done || reloadClaimed) return;
    stop();
    void handleNeedReload(reload);
  };
  function onState() {
    if (!worker || (worker.state !== 'activated' && worker.state !== 'redundant')) return;
    worker.removeEventListener('statechange', onState);
    timers.forEach(clearTimeout);
    timers.clear();
    if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) {
      reloadOnce();
    } else {
      timers.add(setTimeout(reloadOnce, RELOAD_GRACE_MS));
    }
  }
  stopWatching = stop;
  watchActive = true;
  timers.add(
    setTimeout(() => {
      if (done || reloadClaimed) return;
      stop();
      setProblem('notActivated');
    }, ACTIVATION_TIMEOUT_MS),
  );
  if (worker) {
    worker.addEventListener('statechange', onState);
    onState();
  }
}

/** Sends skip-waiting through the plugin and starts the activation watch (see `watchActivation`). */
async function activate(reload: () => void): Promise<void> {
  const registration = updater.registration;
  const worker = registration?.waiting ?? null;
  const started = updater.updateServiceWorker;
  if (!started) return;
  if (worker) {
    watchActivation(worker, reload);
  } else if (!watchActive) {
    // Nothing waiting: either the worker is already active (a second click while it was
    // activating, or a missed event) or the click does nothing. Never replace a running watch.
    const active = registration?.active;
    const controller =
      typeof navigator === 'undefined' ? null : navigator.serviceWorker?.controller;
    if (active?.state === 'activated' && (!controller || controller !== active)) {
      void handleNeedReload(reload);
      return;
    }
    watchActivation(null, reload);
  }
  await started(true);
}

/**
 * Applies the waiting update: first awaits every pending autosave (at most SAVE_TIMEOUT_MS), then
 * activates the new worker. Normally its `controlling` event reloads via `handleNeedReload`; as a
 * safety net `watchActivation` reloads through `handleNeedReload` too once the worker is activated
 * and the plugin did not (uncontrolled page), and tells the person if nothing happens. Resolves
 * `false`, without updating, if the answers could not be saved or saving takes too long; the
 * problem is then published for the notification ("reload anyway" after a timeout).
 */
export async function applyUpdate(reload: () => void = reloadPage): Promise<boolean> {
  setProblem(null);
  if (hasUnsavedWork()) {
    // Unsaved builder changes would be lost by the reload: the person saves (or discards) first.
    setProblem('unsaved');
    return false;
  }
  const result = await save();
  if (result !== 'saved') {
    setProblem(result);
    return false;
  }
  if (reloadPending) {
    reloadPending = false;
    emit();
    reloadClaimed = true;
    reload();
    return true;
  }
  await activate(reload);
  return true;
}

/**
 * Called instead of the plugin's own `location.reload()` once the new worker controls the page,
 * in this tab and in every other open tab: saves pending answers first, then reloads. If saving
 * fails, the page stays and the indicator offers the reload again (no data loss, no loop).
 * A tab with unsaved builder changes is never reloaded automatically either: it keeps the
 * indicator (reloadPending) and the person reloads after saving.
 */
export async function handleNeedReload(reload: () => void = reloadPage): Promise<void> {
  if (reloadClaimed) return;
  reloadClaimed = true;
  stopWatching?.();
  // Stays claimed only if the reload starts; when saving fails `needReload` releases the claim.
  await needReload(reload);
}

async function needReload(reload: () => void): Promise<void> {
  if (!skipSave && hasUnsavedWork()) {
    reloadClaimed = false;
    reloadPending = true;
    emit();
    setProblem('unsaved');
    return;
  }
  const result = skipSave ? 'saved' : await save();
  if (result === 'saved') {
    reload();
    // Still here after a while: the reload was cancelled (beforeunload prompt). Release the claim
    // and keep the indicator, so the person can reload again.
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
      reloadClaimed = false;
      reloadPending = true;
      emit();
    }, RELOAD_RELEASE_MS);
    return;
  }
  reloadClaimed = false;
  reloadPending = true;
  emit();
  setProblem(result);
}

/**
 * "Reload anyway" after a save timeout, only on the person's explicit request: updates without
 * waiting for the hanging save (answers typed in the last moments may be lost).
 */
export async function forceUpdate(reload: () => void = reloadPage): Promise<void> {
  setProblem(null);
  if (reloadPending) {
    reloadClaimed = true;
    reload();
    return;
  }
  skipSave = true;
  await activate(reload);
}

export type UpdateCheckResult = 'found' | 'latest' | 'failed';

/** Manual "check for updates" (About page): the only way in a standalone PWA without reload button. */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const registration = updater.registration;
  if (!registration) return 'failed';
  try {
    await registration.update();
  } catch (error) {
    console.warn('Update check failed', error);
    return 'failed';
  }
  return registration.installing || registration.waiting ? 'found' : 'latest';
}
