import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startUpdateChecks } from './updateChecks';

const HOUR = 60 * 60 * 1000;
const MIN_GAP = 5 * 60 * 1000;

function fakeRegistration() {
  return {
    installing: null as ServiceWorker | null,
    update: vi.fn(() => Promise.resolve()),
  };
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

let online = true;

beforeEach(() => {
  vi.useFakeTimers();
  online = true;
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

describe('startUpdateChecks', () => {
  it('checks for a new version every hour by default', () => {
    const reg = fakeRegistration();
    const stop = startUpdateChecks(reg);
    expect(reg.update).not.toHaveBeenCalled();
    vi.advanceTimersByTime(HOUR);
    expect(reg.update).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(HOUR);
    expect(reg.update).toHaveBeenCalledTimes(2);
    stop();
  });

  it('checks when the page becomes visible, at most every 5 minutes', () => {
    const reg = fakeRegistration();
    const stop = startUpdateChecks(reg);
    setVisibility('visible'); // registration itself just checked
    expect(reg.update).not.toHaveBeenCalled();
    vi.advanceTimersByTime(MIN_GAP);
    setVisibility('hidden');
    expect(reg.update).not.toHaveBeenCalled();
    setVisibility('visible');
    expect(reg.update).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(MIN_GAP - 1);
    setVisibility('visible');
    expect(reg.update).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    setVisibility('visible');
    expect(reg.update).toHaveBeenCalledTimes(2);
    stop();
  });

  it('does not check while offline or while a new worker is installing', () => {
    const reg = fakeRegistration();
    const stop = startUpdateChecks(reg);
    online = false;
    vi.advanceTimersByTime(HOUR);
    expect(reg.update).not.toHaveBeenCalled();
    online = true;
    reg.installing = {} as ServiceWorker;
    vi.advanceTimersByTime(HOUR);
    expect(reg.update).not.toHaveBeenCalled();
    reg.installing = null;
    vi.advanceTimersByTime(HOUR);
    expect(reg.update).toHaveBeenCalledTimes(1);
    stop();
  });

  it('logs a failed check quietly and tries again later', async () => {
    const reg = fakeRegistration();
    reg.update.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stop = startUpdateChecks(reg);
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(warn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(HOUR);
    expect(reg.update).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
    stop();
  });

  it('stops the interval and the visibility listener when stopped', () => {
    const reg = fakeRegistration();
    const stop = startUpdateChecks(reg, { intervalMs: 1000, minGapMs: 0 });
    stop();
    vi.advanceTimersByTime(10_000);
    setVisibility('visible');
    expect(reg.update).not.toHaveBeenCalled();
  });
});
