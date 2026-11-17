import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerPendingWrite, registerUnsavedWork } from './pendingWrites';
import {
  applyUpdate,
  checkForUpdate,
  connectUpdater,
  forceUpdate,
  handleNeedReload,
  resetUpdateState,
  setUpdateWaiting,
  useUpdateAvailable,
  useUpdateProblem,
} from './updateState';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((off) => off());
  act(() => resetUpdateState());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const hangingWrite = () => new Promise<void>(() => {});

describe('updateState', () => {
  it('shares "update waiting" with every subscriber', () => {
    const { result } = renderHook(() => useUpdateAvailable());
    expect(result.current).toBe(false);
    act(() => setUpdateWaiting(true));
    expect(result.current).toBe(true);
  });

  it('applyUpdate waits for every pending autosave before activating the new worker', async () => {
    const updateServiceWorker = vi.fn(() => Promise.resolve());
    connectUpdater({ updateServiceWorker });
    const write = deferred();
    cleanups.push(registerPendingWrite(() => write.promise));
    const applied = applyUpdate();
    await Promise.resolve();
    await Promise.resolve();
    expect(updateServiceWorker).not.toHaveBeenCalled();
    write.resolve();
    await expect(applied).resolves.toBe(true);
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('applyUpdate does not activate the new worker when saving failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const updateServiceWorker = vi.fn(() => Promise.resolve());
    connectUpdater({ updateServiceWorker });
    cleanups.push(registerPendingWrite(() => Promise.reject(new Error('quota'))));
    await expect(applyUpdate()).resolves.toBe(false);
    expect(updateServiceWorker).not.toHaveBeenCalled();
  });

  it('handleNeedReload reloads only after every pending autosave has finished', async () => {
    const reload = vi.fn();
    const write = deferred();
    cleanups.push(registerPendingWrite(() => write.promise));
    const done = handleNeedReload(reload);
    await Promise.resolve();
    await Promise.resolve();
    expect(reload).not.toHaveBeenCalled();
    write.resolve();
    await done;
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('handleNeedReload keeps the page if saving failed; the indicator then reloads after a retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    const updateServiceWorker = vi.fn(() => Promise.resolve());
    connectUpdater({ updateServiceWorker });
    let fail = true;
    cleanups.push(
      registerPendingWrite(() => (fail ? Promise.reject(new Error('quota')) : Promise.resolve())),
    );
    const { result } = renderHook(() => useUpdateAvailable());
    await act(() => handleNeedReload(reload));
    expect(reload).not.toHaveBeenCalled();
    expect(result.current).toBe(true); // indicator stays so the person can retry

    fail = false;
    let applied: boolean | undefined;
    await act(async () => {
      applied = await applyUpdate(reload);
    });
    expect(applied).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(false);
    expect(updateServiceWorker).not.toHaveBeenCalled(); // the new worker already controls the page
  });

  it('applyUpdate stops waiting for a hanging save after 10 s; only "reload anyway" updates', async () => {
    vi.useFakeTimers();
    const updateServiceWorker = vi.fn(() => Promise.resolve());
    connectUpdater({ updateServiceWorker });
    cleanups.push(registerPendingWrite(hangingWrite));
    const { result } = renderHook(() => useUpdateProblem());
    let applied: boolean | undefined;
    void applyUpdate().then((ok) => (applied = ok));
    await act(() => vi.advanceTimersByTimeAsync(9_999));
    expect(applied).toBeUndefined();
    expect(result.current).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(applied).toBe(false);
    expect(result.current).toBe('timeout');
    expect(updateServiceWorker).not.toHaveBeenCalled(); // never silently

    await act(() => forceUpdate());
    expect(result.current).toBeNull();
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
    // The new worker takes control: reload without waiting for the hanging save again.
    const reload = vi.fn();
    await handleNeedReload(reload);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('handleNeedReload with a hanging save: no reload, problem "timeout"; reload anyway reloads', async () => {
    vi.useFakeTimers();
    cleanups.push(registerPendingWrite(hangingWrite));
    const reload = vi.fn();
    const problem = renderHook(() => useUpdateProblem());
    const available = renderHook(() => useUpdateAvailable());
    void handleNeedReload(reload);
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(reload).not.toHaveBeenCalled();
    expect(problem.result.current).toBe('timeout');
    expect(available.result.current).toBe(true);
    await act(() => forceUpdate(reload));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('checkForUpdate reports found / latest / failed', async () => {
    const registration = {
      installing: null as ServiceWorker | null,
      waiting: null as ServiceWorker | null,
      update: vi.fn(() => Promise.resolve()),
    };
    connectUpdater({ registration });
    await expect(checkForUpdate()).resolves.toBe('latest');

    registration.update.mockImplementationOnce(() => {
      registration.installing = {} as ServiceWorker;
      return Promise.resolve();
    });
    await expect(checkForUpdate()).resolves.toBe('found');

    vi.spyOn(console, 'warn').mockImplementation(() => {});
    registration.installing = null;
    registration.update.mockRejectedValueOnce(new TypeError('offline'));
    await expect(checkForUpdate()).resolves.toBe('failed');

    connectUpdater({ registration: undefined });
    await expect(checkForUpdate()).resolves.toBe('failed');
  });

  it('handleNeedReload does not reload a tab with unsaved builder work; it keeps the indicator', async () => {
    const release = registerUnsavedWork();
    cleanups.push(release);
    const reload = vi.fn();
    const available = renderHook(() => useUpdateAvailable());
    const problem = renderHook(() => useUpdateProblem());
    await act(() => handleNeedReload(reload));
    expect(reload).not.toHaveBeenCalled();
    expect(available.result.current).toBe(true);
    expect(problem.result.current).toBe('unsaved');
    // Saved (or discarded) -> the indicator reloads.
    release();
    await act(async () => {
      expect(await applyUpdate(reload)).toBe(true);
    });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('applyUpdate refuses while builder work is unsaved and does not activate the new worker', async () => {
    cleanups.push(registerUnsavedWork());
    const updateServiceWorker = vi.fn(() => Promise.resolve());
    connectUpdater({ updateServiceWorker });
    const problem = renderHook(() => useUpdateProblem());
    let ok = true;
    await act(async () => {
      ok = await applyUpdate(vi.fn());
    });
    expect(ok).toBe(false);
    expect(updateServiceWorker).not.toHaveBeenCalled();
    expect(problem.result.current).toBe('unsaved');
  });
});

describe('updateState activation watch', () => {
  function fakeWorker() {
    const target = new EventTarget();
    const worker = Object.assign(target, { state: 'installed' }) as EventTarget & { state: string };
    const activate = () => {
      worker.state = 'activated';
      target.dispatchEvent(new Event('statechange'));
    };
    return { worker: worker as unknown as ServiceWorker, activate };
  }
  function setup(controlled: boolean) {
    vi.useFakeTimers();
    const { worker, activate } = fakeWorker();
    vi.stubGlobal('navigator', { serviceWorker: { controller: controlled ? {} : null } });
    connectUpdater({
      updateServiceWorker: vi.fn(() => Promise.resolve()),
      registration: { installing: null, waiting: worker, update: vi.fn() },
    });
    return { activate, reload: vi.fn() };
  }
  afterEach(() => vi.unstubAllGlobals());

  it('reloads once after activation when the page was not controlled', async () => {
    const { activate, reload } = setup(false);
    await applyUpdate(reload);
    expect(reload).not.toHaveBeenCalled();
    activate();
    await vi.advanceTimersByTimeAsync(0);
    expect(reload).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload a second time when handleNeedReload reloaded first', async () => {
    const { activate, reload } = setup(true);
    await applyUpdate(reload);
    activate();
    await handleNeedReload(reload);
    expect(reload).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads after the grace period if the plugin never reloads a controlled page', async () => {
    const { activate, reload } = setup(true);
    await applyUpdate(reload);
    activate();
    expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload with unsaved builder work after activation, and says so', async () => {
    const { activate, reload } = setup(false);
    const { result } = renderHook(() => useUpdateProblem());
    await applyUpdate(reload);
    cleanups.push(registerUnsavedWork());
    activate();
    await vi.advanceTimersByTimeAsync(0);
    expect(reload).not.toHaveBeenCalled();
    expect(result.current).toBe('unsaved');
  });

  it('releases the claim when the reload was cancelled, so the indicator can reload again', async () => {
    const { activate, reload } = setup(false);
    await applyUpdate(reload);
    activate();
    await vi.advanceTimersByTimeAsync(0);
    expect(reload).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5_000);
    const { result } = renderHook(() => useUpdateAvailable());
    expect(result.current).toBe(true);
    await applyUpdate(reload);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('a second click while activating keeps the watch: exactly one reload', async () => {
    const { worker, activate } = fakeWorker();
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { serviceWorker: { controller: null } });
    const registration = { installing: null, waiting: worker, active: null, update: vi.fn() };
    connectUpdater({
      updateServiceWorker: vi.fn(() => Promise.resolve()),
      registration: registration as never,
    });
    const reload = vi.fn();
    await applyUpdate(reload);
    (registration as { waiting: unknown }).waiting = null;
    await applyUpdate(reload);
    activate();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads at once when nothing waits but the active worker is activated on an uncontrolled page', async () => {
    vi.useFakeTimers();
    const { worker } = fakeWorker();
    (worker as unknown as { state: string }).state = 'activated';
    vi.stubGlobal('navigator', { serviceWorker: { controller: null } });
    connectUpdater({
      updateServiceWorker: vi.fn(() => Promise.resolve()),
      registration: { installing: null, waiting: null, active: worker, update: vi.fn() },
    });
    const reload = vi.fn();
    await applyUpdate(reload);
    await vi.advanceTimersByTimeAsync(0);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('shows a problem and does not reload when the worker never activates', async () => {
    const { reload } = setup(false);
    const { result } = renderHook(() => useUpdateProblem());
    await applyUpdate(reload);
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(result.current).toBe('notActivated');
    expect(reload).not.toHaveBeenCalled();
  });
});
