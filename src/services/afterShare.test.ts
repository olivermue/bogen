import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/db';
import { createEntry, getEntry } from '../db/entries';
import { saveSettings } from '../db/settings';
import { makeForm } from '../db/testUtils';
import { runCleanup } from '../domain/cleanup';
import { afterSuccessfulShare } from './afterShare';

const now = new Date('2026-11-16T12:00:00Z');

beforeEach(async () => {
  await Promise.all([db.forms.clear(), db.entries.clear(), db.settings.clear()]);
});

describe('afterSuccessfulShare', () => {
  it('marks shared and keeps the entry for never', async () => {
    const entry = await createEntry(makeForm(), 'own');
    const res = await afterSuccessfulShare(entry, 'never', now);
    expect(res).toEqual({ deleted: false });
    expect((await getEntry(entry.id))?.sharedAt).toBe(now.toISOString());
  });

  it('keeps the entry for timed settings', async () => {
    const entry = await createEntry(makeForm(), 'own');
    expect((await afterSuccessfulShare(entry, '7d', now)).deleted).toBe(false);
    expect(await getEntry(entry.id)).toBeDefined();
  });

  it('deletes immediately and undo restores the entry as never shared', async () => {
    const entry = await createEntry(makeForm(), 'own');
    const res = await afterSuccessfulShare(entry, 'immediately', now);
    expect(res.deleted).toBe(true);
    expect(await getEntry(entry.id)).toBeUndefined();
    await res.undo?.();
    expect(await getEntry(entry.id)).toEqual({ ...entry, sharedAt: null });
  });

  it('an undone entry survives the next cleanup', async () => {
    await saveSettings({ deleteAfterShare: 'immediately' });
    const entry = await createEntry(makeForm(), 'own');
    const res = await afterSuccessfulShare(entry, 'immediately', now);
    await res.undo?.();
    expect(await runCleanup(new Date(now.getTime() + 60_000))).toBe(0);
    expect(await getEntry(entry.id)).toBeDefined();
  });
});
