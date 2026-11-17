import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entry } from '../../db/db';
import type { UpdateAnswersResult } from '../../db/entries';
import { isEntryOpen } from '../../db/openEntries';
import type { Answers } from '../../schema/form';
import { flushAllPendingWrites } from '../../pwa/pendingWrites';
import { useAutosave, type AutosaveOptions } from './useAutosave';

const updateAnswers = vi.hoisted(() =>
  vi.fn<(id: string, answers: Answers, restoreFrom?: Entry) => Promise<UpdateAnswersResult>>(),
);
vi.mock('../../db/entries', () => ({ updateAnswers }));

const ENTRY = { id: 'e1' } as Entry;

function setup(initial: Answers, options: Omit<AutosaveOptions, 'restoreFrom'> = {}) {
  return renderHook(
    ({ answers }: { answers: Answers }) =>
      useAutosave('e1', answers, { restoreFrom: ENTRY, ...options }),
    { initialProps: { answers: initial } },
  );
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

beforeEach(() => {
  vi.useFakeTimers();
  updateAnswers.mockReset().mockResolvedValue('updated');
});

afterEach(() => {
  vi.useRealTimers();
  setVisibility('visible');
});

describe('useAutosave', () => {
  it('does not write unchanged answers on mount', () => {
    setup({ a: 'x' });
    vi.advanceTimersByTime(1000);
    expect(updateAnswers).not.toHaveBeenCalled();
  });

  it('writes every change immediately, without waiting', () => {
    const { rerender } = setup({});
    rerender({ answers: { a: 'H' } });
    expect(updateAnswers).toHaveBeenCalledTimes(1);
    expect(updateAnswers).toHaveBeenCalledWith('e1', { a: 'H' }, ENTRY);
  });

  it('coalesces a burst while a write is pending: latest value stored, at most 2 writes', async () => {
    const resolvers: (() => void)[] = [];
    updateAnswers.mockImplementation(
      () => new Promise<UpdateAnswersResult>((r) => resolvers.push(() => r('updated'))),
    );
    const { rerender, result } = setup({});
    rerender({ answers: { a: '1' } });
    rerender({ answers: { a: '12' } });
    rerender({ answers: { a: '123' } });
    rerender({ answers: { a: '1234' } });
    expect(updateAnswers).toHaveBeenCalledTimes(1); // one in flight, the rest waits
    expect(updateAnswers).toHaveBeenLastCalledWith('e1', { a: '1' }, ENTRY);
    resolvers[0]?.();
    await vi.waitFor(() => expect(updateAnswers).toHaveBeenCalledTimes(2));
    expect(updateAnswers).toHaveBeenLastCalledWith('e1', { a: '1234' }, ENTRY);
    resolvers[1]?.();
    await result.current();
    expect(updateAnswers).toHaveBeenCalledTimes(2);
  });

  it('flush() resolves only after the follow-up write for newer answers', async () => {
    const resolvers: (() => void)[] = [];
    updateAnswers.mockImplementation(
      () => new Promise<UpdateAnswersResult>((r) => resolvers.push(() => r('updated'))),
    );
    const { rerender, result } = setup({});
    rerender({ answers: { a: '1' } });
    rerender({ answers: { a: '2' } });
    let done = false;
    const flushed = result.current().then(() => {
      done = true;
    });
    resolvers[0]?.();
    await vi.waitFor(() => expect(updateAnswers).toHaveBeenCalledTimes(2));
    expect(done).toBe(false);
    resolvers[1]?.();
    await flushed;
    expect(done).toBe(true);
  });

  // Review Focus 1: tab closed / reloaded mid-typing.
  it('flushes pending answers on pagehide', () => {
    const { rerender } = setup({});
    rerender({ answers: { a: 'typed' } });
    window.dispatchEvent(new Event('pagehide'));
    expect(updateAnswers).toHaveBeenCalledWith('e1', { a: 'typed' }, ENTRY);
    expect(updateAnswers).toHaveBeenCalledTimes(1); // already written by the change itself
  });

  it('flushes answers that are still waiting behind a running write on beforeunload', async () => {
    let resolveFirst: () => void = () => {};
    updateAnswers.mockImplementationOnce(
      () => new Promise<UpdateAnswersResult>((r) => (resolveFirst = () => r('updated'))),
    );
    const { rerender } = setup({});
    rerender({ answers: { a: '1' } });
    rerender({ answers: { a: '12' } });
    window.dispatchEvent(new Event('beforeunload'));
    expect(updateAnswers).toHaveBeenCalledTimes(1);
    resolveFirst();
    await vi.waitFor(() =>
      expect(updateAnswers).toHaveBeenLastCalledWith('e1', { a: '12' }, ENTRY),
    );
  });

  it('flushes pending answers when the page becomes hidden', () => {
    const { rerender } = setup({});
    rerender({ answers: { a: 'typed' } });
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(updateAnswers).toHaveBeenCalledWith('e1', { a: 'typed' }, ENTRY);
  });

  it('visibilitychange to visible does not write again', () => {
    const { rerender } = setup({});
    rerender({ answers: { a: 'typed' } });
    expect(updateAnswers).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(updateAnswers).toHaveBeenCalledTimes(1);
  });

  it('flushes pending answers on unmount', () => {
    const { rerender, unmount } = setup({});
    rerender({ answers: { a: 'typed' } });
    unmount();
    expect(updateAnswers).toHaveBeenCalledWith('e1', { a: 'typed' }, ENTRY);
  });

  it('does nothing on pagehide without pending changes', () => {
    setup({ a: 'x' });
    window.dispatchEvent(new Event('pagehide'));
    expect(updateAnswers).not.toHaveBeenCalled();
  });

  it('flush() writes pending answers immediately and resolves after the write', async () => {
    let resolveWrite: () => void = () => {};
    updateAnswers.mockImplementation(
      () => new Promise<UpdateAnswersResult>((r) => (resolveWrite = () => r('updated'))),
    );
    const { result, rerender } = setup({});
    rerender({ answers: { a: 'typed' } });
    let done = false;
    let flushed: Promise<void> = Promise.resolve();
    act(() => {
      flushed = result.current().then(() => {
        done = true;
      });
    });
    expect(updateAnswers).toHaveBeenCalledWith('e1', { a: 'typed' }, ENTRY);
    await Promise.resolve();
    expect(done).toBe(false);
    resolveWrite();
    await flushed;
    expect(done).toBe(true);
  });

  it('keeps flushing after a failed write', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    updateAnswers.mockRejectedValueOnce(new Error('quota'));
    const { rerender } = setup({});
    rerender({ answers: { a: '1' } });
    window.dispatchEvent(new Event('pagehide'));
    await vi.runAllTimersAsync();
    rerender({ answers: { a: '2' } });
    window.dispatchEvent(new Event('pagehide'));
    expect(updateAnswers).toHaveBeenLastCalledWith('e1', { a: '2' }, ENTRY);
    await vi.runAllTimersAsync();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('retries the same answers after a failed write', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    updateAnswers.mockRejectedValueOnce(new Error('quota'));
    const { rerender } = setup({});
    rerender({ answers: { a: '1' } });
    window.dispatchEvent(new Event('pagehide'));
    expect(updateAnswers).toHaveBeenCalledTimes(1);
    await vi.runAllTimersAsync(); // let the rejection settle
    window.dispatchEvent(new Event('pagehide'));
    expect(updateAnswers).toHaveBeenCalledTimes(2);
    expect(updateAnswers).toHaveBeenLastCalledWith('e1', { a: '1' }, ENTRY);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
  it('registers its flush for flushAllPendingWrites (before an update reload) until unmount', async () => {
    const resolvers: (() => void)[] = [];
    updateAnswers.mockImplementation(
      () => new Promise<UpdateAnswersResult>((r) => resolvers.push(() => r('updated'))),
    );
    const { rerender, unmount } = setup({});
    rerender({ answers: { a: '1' } });
    let done = false;
    const all = flushAllPendingWrites().then((ok) => {
      done = true;
      return ok;
    });
    await Promise.resolve();
    expect(done).toBe(false);
    resolvers[0]?.();
    await expect(all).resolves.toBe(true);

    unmount();
    updateAnswers.mockClear();
    await flushAllPendingWrites();
    expect(updateAnswers).not.toHaveBeenCalled();
  });

  it('reports failing only once per failure streak and recovery after a success', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onFailingChange = vi.fn();
    updateAnswers.mockRejectedValue(new Error('quota'));
    const { rerender } = setup({}, { onFailingChange });
    rerender({ answers: { a: '1' } });
    await vi.runAllTimersAsync();
    rerender({ answers: { a: '12' } });
    await vi.runAllTimersAsync();
    rerender({ answers: { a: '123' } });
    await vi.runAllTimersAsync();
    expect(onFailingChange.mock.calls).toEqual([[true]]);
    updateAnswers.mockResolvedValue('updated');
    rerender({ answers: { a: '1234' } });
    await vi.runAllTimersAsync();
    expect(onFailingChange.mock.calls).toEqual([[true], [false]]);
    error.mockRestore();
  });

  it('calls onRestored when the write had to put the vanished entry back', async () => {
    const onRestored = vi.fn();
    updateAnswers.mockResolvedValue('restored');
    const { rerender } = setup({}, { onRestored });
    rerender({ answers: { a: '1' } });
    await vi.runAllTimersAsync();
    expect(onRestored).toHaveBeenCalledTimes(1);
  });

  it('marks the entry as open while mounted (cleanup skips it)', () => {
    const { unmount } = setup({});
    expect(isEntryOpen('e1')).toBe(true);
    unmount();
    expect(isEntryOpen('e1')).toBe(false);
  });
});
