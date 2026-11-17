import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RELOAD_MARKER,
  installChunkErrorRecovery,
  isChunkLoadError,
  isReloadScheduled,
  recoverFromChunkError,
  resetApp,
  resetChunkRecovery,
} from './chunkErrorRecovery';

const SCOPE = 'https://user.github.io/bogen/';

afterEach(() => {
  resetChunkRecovery();
  window.history.replaceState(null, '');
  vi.restoreAllMocks();
});

describe('isChunkLoadError', () => {
  it.each([
    new TypeError('Failed to fetch dynamically imported module: https://x/assets/a.js'),
    new TypeError('Importing a module script failed.'),
    new TypeError('error loading dynamically imported module: https://x/assets/a.js'),
    new Error('Unable to preload CSS for /assets/a.css'),
  ])('recognises %s', (error) => {
    expect(isChunkLoadError(error)).toBe(true);
  });

  it.each([new Error('boom'), 'Failed to fetch dynamically imported module', null])(
    'ignores %s',
    (error) => {
      expect(isChunkLoadError(error)).toBe(false);
    },
  );
});

describe('recoverFromChunkError', () => {
  it('reloads once; marks the history entry so a second failure does not reload again', async () => {
    const reload = vi.fn();
    const prepare = vi.fn(() => Promise.resolve());
    let now = 1_000_000;
    const deps = { reload, prepare, now: () => now };

    expect(recoverFromChunkError(deps)).toBe(true);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(prepare).toHaveBeenCalledTimes(1);
    expect((window.history.state as Record<string, unknown>)[RELOAD_MARKER]).toBe(now);

    // Further failures in the same document wait for the reload that is underway.
    expect(isReloadScheduled()).toBe(true);
    expect(recoverFromChunkError(deps)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);

    // After the reload (new document) the same history entry still carries the marker.
    resetChunkRecovery();
    now += 5_000;
    expect(recoverFromChunkError(deps)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads at most once when a failed navigation pushed a new entry before the reload', async () => {
    const reload = vi.fn();
    let finishPrepare = () => {};
    const prepare = () => new Promise<void>((resolve) => (finishPrepare = resolve));
    const now = 1_000_000;
    const deps = { reload, prepare, now: () => now };

    window.history.replaceState({ idx: 0 }, '', '#/forms');
    expect(recoverFromChunkError(deps)).toBe(true);
    // The router completes the failed navigation (error state) on a new entry.
    window.history.pushState({ idx: 1 }, '', '#/forms/new');
    finishPrepare();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(window.history.state).toMatchObject({ idx: 1, [RELOAD_MARKER]: now });

    // After the reload the route on the new entry fails again: no second automatic reload.
    resetChunkRecovery();
    expect(recoverFromChunkError({ ...deps, now: () => now + 3_000 })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('keeps other history state (the router index)', () => {
    window.history.replaceState({ idx: 3, key: 'k' }, '');
    recoverFromChunkError({ reload: vi.fn(), prepare: () => Promise.resolve(), now: () => 1 });
    expect(window.history.state).toMatchObject({ idx: 3, key: 'k', [RELOAD_MARKER]: 1 });
  });

  it('reloads again when the marker is old (a later release)', async () => {
    const reload = vi.fn();
    window.history.replaceState({ [RELOAD_MARKER]: 0 }, '');
    expect(
      recoverFromChunkError({ reload, prepare: () => Promise.resolve(), now: () => 10 * 60_000 }),
    ).toBe(true);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('still reloads when preparing (save, activate new worker) fails or hangs', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reload = vi.fn();
    recoverFromChunkError({ reload, prepare: () => Promise.reject(new Error('x')), now: () => 1 });
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));

    resetChunkRecovery();
    window.history.replaceState(null, '');
    vi.useFakeTimers();
    const reload2 = vi.fn();
    recoverFromChunkError({ reload: reload2, prepare: () => new Promise(() => {}), now: () => 1 });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(reload2).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('installChunkErrorRecovery', () => {
  it('starts the reload on vite:preloadError but lets the real error reach the caller', async () => {
    const reload = vi.fn();
    const uninstall = installChunkErrorRecovery(window, {
      reload,
      prepare: () => Promise.resolve(),
      now: () => 5,
    });
    const first = new Event('vite:preloadError', { cancelable: true });
    window.dispatchEvent(first);
    // With preventDefault Vite would resolve the import to undefined (unrelated TypeError).
    expect(first.defaultPrevented).toBe(false);
    expect(isReloadScheduled()).toBe(true);
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));

    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    expect(reload).toHaveBeenCalledTimes(1);
    // Later calls without deps use the installed ones (and still see the scheduled reload).
    expect(recoverFromChunkError()).toBe(true);
    uninstall();
  });
});

describe('resetApp', () => {
  function fakeCaches(names: string[]) {
    const store = new Set(names);
    return {
      store,
      keys: vi.fn(() => Promise.resolve([...store])),
      delete: vi.fn((name: string) => Promise.resolve(store.delete(name))),
    };
  }

  it('deletes only own Workbox caches, unregisters only the own worker, never IndexedDB', async () => {
    const caches = fakeCaches([
      `workbox-precache-v2-${SCOPE}`,
      `workbox-runtime-${SCOPE}`,
      'workbox-precache-v2-https://user.github.io/',
      'workbox-precache-v2-https://user.github.io/other/',
      'workbox-precache-v2-https://user.github.io/bogen/sub/',
      'some-other-cache',
    ]);
    const unregister = vi.fn(() => Promise.resolve(true));
    const serviceWorker = {
      getRegistration: vi.fn(() => Promise.resolve({ scope: SCOPE, unregister })),
    };
    const reload = vi.fn();
    const deleteDatabase = vi.spyOn(indexedDB, 'deleteDatabase');
    window.history.replaceState({ [RELOAD_MARKER]: 1 }, '');

    await resetApp({ caches, serviceWorker, scope: SCOPE, reload });

    expect([...caches.store].sort()).toEqual(
      [
        'some-other-cache',
        'workbox-precache-v2-https://user.github.io/',
        'workbox-precache-v2-https://user.github.io/bogen/sub/',
        'workbox-precache-v2-https://user.github.io/other/',
      ].sort(),
    );
    expect(serviceWorker.getRegistration).toHaveBeenCalledWith(SCOPE);
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(deleteDatabase).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    // Fresh start: an automatic reload is allowed again.
    expect(
      (window.history.state as Record<string, unknown> | null)?.[RELOAD_MARKER],
    ).toBeUndefined();
  });

  it('leaves a worker of another project with a wider scope alone', async () => {
    const unregister = vi.fn(() => Promise.resolve(true));
    const serviceWorker = {
      getRegistration: vi.fn(() =>
        Promise.resolve({ scope: 'https://user.github.io/', unregister }),
      ),
    };
    const reload = vi.fn();
    await resetApp({ caches: fakeCaches([]), serviceWorker, scope: SCOPE, reload });
    expect(unregister).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('still reloads when the Cache API or service workers are not available', async () => {
    const reload = vi.fn();
    await resetApp({ caches: undefined, serviceWorker: undefined, scope: SCOPE, reload });
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
