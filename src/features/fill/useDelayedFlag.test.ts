import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDelayedFlag } from './useDelayedFlag';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDelayedFlag', () => {
  it('turns true only after the delay', () => {
    const { result, rerender } = renderHook(({ flag }) => useDelayedFlag(flag, 300), {
      initialProps: { flag: false },
    });
    rerender({ flag: true });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it('never turns true for a short flag and turns false at once', () => {
    const { result, rerender } = renderHook(({ flag }) => useDelayedFlag(flag, 300), {
      initialProps: { flag: true },
    });
    act(() => vi.advanceTimersByTime(100));
    rerender({ flag: false });
    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBe(false);

    rerender({ flag: true });
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe(true);
    rerender({ flag: false });
    expect(result.current).toBe(false);
  });
});
