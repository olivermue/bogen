import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as cleanup from '../../domain/cleanup';
import { useCleanupOnActive } from './useCleanupOnActive';

const setVisibility = (state: DocumentVisibilityState) => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  document.dispatchEvent(new Event('visibilitychange'));
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCleanupOnActive', () => {
  it('runs on mount and when the page becomes visible, not while hidden', async () => {
    const spy = vi.spyOn(cleanup, 'runCleanup').mockResolvedValue(0);
    renderHook(() => useCleanupOnActive());
    expect(spy).toHaveBeenCalledTimes(1);
    await Promise.resolve();

    setVisibility('hidden');
    expect(spy).toHaveBeenCalledTimes(1);
    setVisibility('visible');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('skips overlapping runs', async () => {
    let finish: (n: number) => void = () => undefined;
    const spy = vi
      .spyOn(cleanup, 'runCleanup')
      .mockImplementation(() => new Promise<number>((resolve) => (finish = resolve)));
    renderHook(() => useCleanupOnActive());
    setVisibility('visible');
    expect(spy).toHaveBeenCalledTimes(1);
    finish(0);
    await vi.waitFor(() => {
      setVisibility('visible');
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  it('removes the listener on unmount', () => {
    const spy = vi.spyOn(cleanup, 'runCleanup').mockResolvedValue(0);
    const { unmount } = renderHook(() => useCleanupOnActive());
    unmount();
    setVisibility('visible');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
