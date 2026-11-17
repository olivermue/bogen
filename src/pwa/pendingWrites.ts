/**
 * Registry of pending writes (autosave `flush()` functions of every open entry). Before the page
 * is reloaded for an app update, `flushAllPendingWrites()` makes sure the last answers are stored.
 */
type Flush = () => Promise<void>;

const flushes = new Set<Flush>();

/** Registers `flush`; returns the function that removes it again. */
export function registerPendingWrite(flush: Flush): () => void {
  flushes.add(flush);
  return () => {
    flushes.delete(flush);
  };
}

/**
 * Flushes every registered write and waits until all have settled.
 * Resolves `true` if all succeeded, `false` if at least one failed (never rejects).
 */
export async function flushAllPendingWrites(): Promise<boolean> {
  const results = await Promise.allSettled(
    [...flushes].map(async (flush) => {
      await flush();
    }),
  );
  const failed = results.filter((r) => r.status === 'rejected');
  for (const result of failed) console.error('Pending write failed', result.reason);
  return failed.length === 0;
}

/**
 * Unsaved work that cannot be flushed automatically (the form builder: saving needs a valid form
 * and the person's decision). While any is registered, an update never reloads this tab on its
 * own; see `handleNeedReload` / `applyUpdate` in updateState.ts.
 */
const unsavedWork = new Set<symbol>();

/** Registers one piece of unsaved work; returns the function that removes it again. */
export function registerUnsavedWork(): () => void {
  const token = Symbol('unsaved');
  unsavedWork.add(token);
  return () => {
    unsavedWork.delete(token);
  };
}

export function hasUnsavedWork(): boolean {
  return unsavedWork.size > 0;
}
