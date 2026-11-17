/** The part of `ServiceWorkerRegistration` the checks need (keeps tests simple). */
export interface UpdatableRegistration {
  readonly installing: ServiceWorker | null;
  update(): Promise<unknown>;
}

export interface UpdateCheckOptions {
  /** Regular check interval; default 1 hour. */
  intervalMs?: number;
  /** Minimum time between two checks (visibility changes can be frequent); default 5 minutes. */
  minGapMs?: number;
}

/**
 * Actively looks for a new app version: installed PWAs stay resident for days, and the browser
 * itself only checks on navigation. Checks hourly and whenever the page becomes visible again,
 * not more often than `minGapMs`, only online and not while a new worker is already installing.
 * Errors (offline, server) are logged quietly; the next check simply tries again.
 * Returns a function that stops all checks.
 */
export function startUpdateChecks(
  registration: UpdatableRegistration,
  { intervalMs = 60 * 60 * 1000, minGapMs = 5 * 60 * 1000 }: UpdateCheckOptions = {},
): () => void {
  // The registration has just fetched the worker script: count that as the first check.
  let last = Date.now();
  const check = () => {
    if (registration.installing || !navigator.onLine) return;
    if (Date.now() - last < minGapMs) return;
    last = Date.now();
    registration.update().catch((error: unknown) => {
      console.warn('Update check failed, retrying later', error);
    });
  };
  const timer = setInterval(check, intervalMs);
  const onVisibility = () => {
    if (document.visibilityState === 'visible') check();
  };
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
