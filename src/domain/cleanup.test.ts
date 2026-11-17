import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import type { Entry } from '../db/db';
import { createEntry, getEntry, markShared, updateAnswers } from '../db/entries';
import { registerOpenEntry } from '../db/openEntries';
import { saveSettings } from '../db/settings';
import { makeForm } from '../db/testUtils';
import { entriesDueForDeletion, runCleanup } from './cleanup';

function e(id: string, sharedAt: string | null): Entry {
  return {
    id,
    formId: 'f',
    formSource: 'own',
    formSnapshot: makeForm(),
    answers: {},
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
    sharedAt,
  };
}

describe('entriesDueForDeletion', () => {
  it('due after 7d only when sharedAt older than 7 days', () => {
    expect(
      entriesDueForDeletion(
        [e('a', '2026-11-01T10:00:00Z')],
        '7d',
        new Date('2026-11-08T09:59:00Z'),
      ),
    ).toEqual([]);
    expect(
      entriesDueForDeletion(
        [e('a', '2026-11-01T10:00:00Z')],
        '7d',
        new Date('2026-11-08T10:00:00Z'),
      ),
    ).toEqual(['a']);
  });
  it('handles 1d and 30d', () => {
    const list = [e('a', '2026-11-01T10:00:00Z')];
    expect(entriesDueForDeletion(list, '1d', new Date('2026-11-02T10:00:00Z'))).toEqual(['a']);
    expect(entriesDueForDeletion(list, '30d', new Date('2026-12-01T09:59:00Z'))).toEqual([]);
    expect(entriesDueForDeletion(list, '30d', new Date('2026-12-01T10:00:00Z'))).toEqual(['a']);
  });
  it('never deletes when setting is never', () => {
    expect(entriesDueForDeletion([e('a', '2000-01-01T00:00:00Z')], 'never', new Date())).toEqual(
      [],
    );
  });
  it('ignores entries without sharedAt', () => {
    for (const s of ['immediately', '1d', '7d', '30d'] as const) {
      expect(entriesDueForDeletion([e('a', null)], s, new Date('2100-01-01T00:00:00Z'))).toEqual(
        [],
      );
    }
  });
  it('immediately: any shared entry is due (crash safety)', () => {
    const list = [e('a', '2026-11-16T11:59:59Z'), e('b', null)];
    expect(entriesDueForDeletion(list, 'immediately', new Date('2026-11-16T12:00:00Z'))).toEqual([
      'a',
    ]);
  });
});

describe('runCleanup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await Promise.all([db.forms.clear(), db.entries.clear(), db.settings.clear()]);
  });

  it('deletes due entries per stored setting and returns the count', async () => {
    const old = await createEntry(makeForm(), 'own');
    const fresh = await createEntry(makeForm(), 'own');
    const unshared = await createEntry(makeForm(), 'own');
    await markShared(old.id, new Date('2026-11-01T10:00:00Z'));
    await markShared(fresh.id, new Date('2026-11-07T10:00:00Z'));
    await saveSettings({ deleteAfterShare: '7d' });
    expect(await runCleanup(new Date('2026-11-08T10:00:00Z'))).toBe(1);
    expect(await getEntry(old.id)).toBeUndefined();
    expect(await getEntry(fresh.id)).toBeDefined();
    expect(await getEntry(unshared.id)).toBeDefined();
  });

  it('returns 0 and deletes nothing for never', async () => {
    const a = await createEntry(makeForm(), 'own');
    await markShared(a.id, new Date('2000-01-01T00:00:00Z'));
    expect(await runCleanup(new Date())).toBe(0);
    expect(await getEntry(a.id)).toBeDefined();
  });

  it('returns 0 instead of throwing when the DB fails', async () => {
    vi.spyOn(db.entries, 'orderBy').mockImplementation(() => {
      throw new Error('boom');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await runCleanup(new Date())).toBe(0);
  });

  it('skips an entry that is open on a page of this tab', async () => {
    const a = await createEntry(makeForm(), 'own');
    await markShared(a.id, new Date('2026-11-01T10:00:00Z'));
    await saveSettings({ deleteAfterShare: '1d' });
    const release = registerOpenEntry(a.id);
    expect(await runCleanup(new Date('2026-11-08T10:00:00Z'))).toBe(0);
    expect(await getEntry(a.id)).toBeDefined();
    release();
    expect(await runCleanup(new Date('2026-11-08T10:00:00Z'))).toBe(1);
  });

  // Race: an edit (sharedAt -> null) between the cleanup's check and its delete must win. With
  // check and delete in one transaction the edit lands either before (entry no longer due) or
  // after (entry gone, and updateAnswers reports 'missing' instead of a fake success).
  it('never deletes an entry after an edit reported success', async () => {
    await saveSettings({ deleteAfterShare: '1d' });
    for (let round = 0; round < 10; round++) {
      const a = await createEntry(makeForm(), 'own');
      await markShared(a.id, new Date('2026-11-01T10:00:00Z'));
      const cleanup = runCleanup(new Date('2026-11-08T10:00:00Z'));
      // Let the cleanup do its reads first (the old code then deleted in a separate step).
      for (let i = 0; i < round; i++) await Promise.resolve();
      const edit = updateAnswers(a.id, { f1: 'typed' });
      const [, result] = await Promise.all([cleanup, edit]);
      const stored = await getEntry(a.id);
      if (result === 'updated') {
        expect(stored?.answers).toEqual({ f1: 'typed' });
        expect(stored?.sharedAt).toBeNull();
      } else {
        expect(result).toBe('missing');
        expect(stored).toBeUndefined();
      }
    }
  });
});
