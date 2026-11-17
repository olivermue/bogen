import { db, type Entry } from '../db/db';
import { listEntries } from '../db/entries';
import { isEntryOpen } from '../db/openEntries';
import { getSettings, type DeleteAfterShare } from '../db/settings';

const DAY = 24 * 60 * 60 * 1000;

export const DELETE_AFTER_MS: Record<Exclude<DeleteAfterShare, 'never' | 'immediately'>, number> = {
  '1d': DAY,
  '7d': 7 * DAY,
  '30d': 30 * DAY,
};

/** Ids of shared entries whose retention elapsed (boundary inclusive). Pure. */
export function entriesDueForDeletion(
  entries: Entry[],
  setting: DeleteAfterShare,
  now: Date,
): string[] {
  if (setting === 'never') return [];
  return entries
    .filter((entry) => {
      if (!entry.sharedAt) return false;
      if (setting === 'immediately') return true;
      return now.getTime() - new Date(entry.sharedAt).getTime() >= DELETE_AFTER_MS[setting];
    })
    .map((entry) => entry.id);
}

/**
 * Deletes due entries per stored setting; returns the count.
 *
 * Reading the setting, deciding and deleting happen in ONE read-write transaction, so an edit
 * (which resets `sharedAt`) can never slip in between the check and the delete. Entries open on
 * a page of this tab are skipped (see `openEntries.ts`).
 * Housekeeping must not break app start: DB errors are logged and yield 0.
 */
export async function runCleanup(now: Date = new Date()): Promise<number> {
  try {
    return await db.transaction('rw', db.entries, db.settings, async () => {
      const settings = await getSettings();
      const entries = await listEntries();
      const ids = entriesDueForDeletion(entries, settings.deleteAfterShare, now).filter(
        (id) => !isEntryOpen(id),
      );
      if (ids.length > 0) await db.entries.bulkDelete(ids);
      return ids.length;
    });
  } catch (error) {
    console.error('Cleanup failed', error);
    return 0;
  }
}
