import type { Answers, Form } from '../schema/form';
import { db, type Entry, type FormSource } from './db';

export async function createEntry(form: Form, source: FormSource): Promise<Entry> {
  const now = new Date().toISOString();
  const entry: Entry = {
    id: crypto.randomUUID(),
    formId: form.id,
    formSource: source,
    formSnapshot: structuredClone(form),
    answers: {},
    createdAt: now,
    updatedAt: now,
    sharedAt: null,
  };
  await db.entries.add(entry);
  return entry;
}

export function getEntry(id: string): Promise<Entry | undefined> {
  return db.entries.get(id);
}

export function listEntries(): Promise<Entry[]> {
  return db.entries.orderBy('updatedAt').reverse().toArray();
}

export type UpdateAnswersResult = 'updated' | 'restored' | 'missing';

/**
 * Stores `answers` and resets `sharedAt` (editing restarts the deletion period).
 *
 * The entry can vanish while its page is still open (cleanup or a delete in another tab). Typed
 * answers must never be dropped silently, so:
 * - with `restoreFrom` (the entry as the page loaded it) a missing entry is put back with the
 *   latest answers, `sharedAt: null` and `updatedAt` now -> `'restored'`;
 * - without it nothing is created (no phantom entry) and the result says `'missing'`.
 */
export async function updateAnswers(
  id: string,
  answers: Answers,
  restoreFrom?: Entry,
): Promise<UpdateAnswersResult> {
  const updatedAt = new Date().toISOString();
  // No wrapping transaction on purpose: the modify must start synchronously (autosave flushes
  // from `pagehide`). The follow-up put is safe on its own: ids are unique, and an entry that
  // reappeared meanwhile is simply overwritten with these, newer answers.
  const count = await db.entries
    .where('id')
    .equals(id)
    .modify({ answers, updatedAt, sharedAt: null });
  if (count > 0) return 'updated';
  if (!restoreFrom || restoreFrom.id !== id) return 'missing';
  await db.entries.put({ ...restoreFrom, answers, updatedAt, sharedAt: null });
  return 'restored';
}

export async function markShared(id: string, now: Date): Promise<void> {
  await db.entries.where('id').equals(id).modify({ sharedAt: now.toISOString() });
}

export function deleteEntry(id: string): Promise<void> {
  return db.entries.delete(id);
}

/** Puts an entry back verbatim (undo of delete). */
export async function restoreEntry(entry: Entry): Promise<void> {
  await db.entries.put(entry);
}

export function deleteEntries(ids: string[]): Promise<void> {
  return db.entries.bulkDelete(ids);
}
