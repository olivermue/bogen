import { deleteEntry, markShared, restoreEntry } from '../db/entries';
import type { Entry } from '../db/db';
import type { DeleteAfterShare } from '../db/settings';

/**
 * Call ONLY after a successful share ('shared' / 'fallback') or copy -- never for
 * 'cancelled' / 'failed'. Marks the entry shared; with 'immediately' also deletes it.
 * `undo` puts the entry back with `sharedAt: null`, as if it had never been shared: the person
 * undid the deletion on purpose, so the next cleanup must not delete it again. Sharing or copying
 * it again starts over.
 */
export async function afterSuccessfulShare(
  entry: Entry,
  setting: DeleteAfterShare,
  now: Date,
): Promise<{ deleted: boolean; undo?: () => Promise<void> }> {
  await markShared(entry.id, now);
  if (setting !== 'immediately') return { deleted: false };
  const restored: Entry = { ...entry, sharedAt: null };
  await deleteEntry(entry.id);
  return { deleted: true, undo: () => restoreEntry(restored) };
}
