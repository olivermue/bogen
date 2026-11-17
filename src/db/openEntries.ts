/**
 * Entries that are open on a page of this tab (the fill page registers its entry while mounted).
 * Cleanup skips them, so an entry is never deleted under the person's hands. Other tabs are not
 * covered here; for them `updateAnswers(..., restoreFrom)` puts a vanished entry back.
 */
const open = new Map<string, number>();

/** Marks `id` as open; returns the function that releases it again. */
export function registerOpenEntry(id: string): () => void {
  open.set(id, (open.get(id) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const count = (open.get(id) ?? 1) - 1;
    if (count <= 0) open.delete(id);
    else open.set(id, count);
  };
}

export function isEntryOpen(id: string): boolean {
  return open.has(id);
}
