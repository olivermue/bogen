import { describe, expect, it, vi } from 'vitest';
import { flushAllPendingWrites, registerPendingWrite } from './pendingWrites';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('pendingWrites', () => {
  it('resolves true when nothing is registered', async () => {
    await expect(flushAllPendingWrites()).resolves.toBe(true);
  });

  it('waits for every registered flush before resolving', async () => {
    const a = deferred();
    const b = deferred();
    const offA = registerPendingWrite(() => a.promise);
    const offB = registerPendingWrite(() => b.promise);
    let done = false;
    const all = flushAllPendingWrites().then((ok) => {
      done = true;
      return ok;
    });
    a.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(done).toBe(false);
    b.resolve();
    await expect(all).resolves.toBe(true);
    offA();
    offB();
  });

  it('resolves false if one flush fails, after all have settled', async () => {
    const slow = deferred();
    const offA = registerPendingWrite(() => Promise.reject(new Error('disk full')));
    const offB = registerPendingWrite(() => slow.promise);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let done = false;
    const all = flushAllPendingWrites().then((ok) => {
      done = true;
      return ok;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(done).toBe(false);
    slow.resolve();
    await expect(all).resolves.toBe(false);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
    offA();
    offB();
  });

  it('a synchronously throwing flush counts as failed', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const off = registerPendingWrite(() => {
      throw new Error('boom');
    });
    await expect(flushAllPendingWrites()).resolves.toBe(false);
    off();
    error.mockRestore();
  });

  it('unregister removes the flush', async () => {
    const flush = vi.fn(() => Promise.resolve());
    const off = registerPendingWrite(flush);
    off();
    await flushAllPendingWrites();
    expect(flush).not.toHaveBeenCalled();
  });
});
