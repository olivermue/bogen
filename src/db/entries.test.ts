import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  createEntry,
  deleteEntries,
  deleteEntry,
  getEntry,
  listEntries,
  markShared,
  restoreEntry,
  updateAnswers,
} from './entries';
import { makeForm } from './testUtils';

beforeEach(async () => {
  await Promise.all([db.forms.clear(), db.entries.clear(), db.settings.clear()]);
});

describe('entries', () => {
  it('createEntry stores a deep copy of the form', async () => {
    const form = makeForm();
    const entry = await createEntry(form, 'own');
    form.title = 'Changed';
    form.fields.pop();
    const stored = await getEntry(entry.id);
    expect(stored?.formSnapshot.title).toBe('Test');
    expect(stored?.formSnapshot.fields).toHaveLength(1);
    expect(stored).toMatchObject({
      formId: 'form-1',
      formSource: 'own',
      sharedAt: null,
      answers: {},
    });
  });

  it('updateAnswers resets sharedAt and bumps updatedAt', async () => {
    const entry = await createEntry(makeForm(), 'own');
    await markShared(entry.id, new Date('2026-02-01T10:00:00Z'));
    expect((await getEntry(entry.id))?.sharedAt).toBe('2026-02-01T10:00:00.000Z');
    await updateAnswers(entry.id, { f1: 'x' });
    const after = await getEntry(entry.id);
    expect(after?.sharedAt).toBeNull();
    expect(after?.answers).toEqual({ f1: 'x' });
    expect(after!.updatedAt >= entry.updatedAt).toBe(true);
  });

  it('updateAnswers on missing id creates nothing and says so', async () => {
    expect(await updateAnswers('nope', { f1: 'x' })).toBe('missing');
    expect(await db.entries.count()).toBe(0);
  });

  it('updateAnswers reports a normal update', async () => {
    const entry = await createEntry(makeForm(), 'own');
    expect(await updateAnswers(entry.id, { f1: 'x' }, entry)).toBe('updated');
  });

  it('updateAnswers puts a vanished entry back from restoreFrom with the latest answers', async () => {
    const entry = await createEntry(makeForm(), 'library');
    await markShared(entry.id, new Date('2026-02-01T10:00:00Z'));
    const loaded = (await getEntry(entry.id))!;
    await deleteEntry(entry.id); // cleanup or another tab
    expect(await updateAnswers(entry.id, { f1: 'late' }, loaded)).toBe('restored');
    const back = await getEntry(entry.id);
    expect(back).toMatchObject({
      id: entry.id,
      formSource: 'library',
      formSnapshot: entry.formSnapshot,
      answers: { f1: 'late' },
      sharedAt: null,
      createdAt: entry.createdAt,
    });
    expect(back!.updatedAt >= entry.updatedAt).toBe(true);
  });

  it('listEntries sorts by updatedAt descending', async () => {
    const base = await createEntry(makeForm(), 'own');
    const mk = (id: string, updatedAt: string) => ({ ...base, id, updatedAt });
    await db.entries.clear();
    await restoreEntry(mk('a', '2026-01-01T00:00:00.000Z'));
    await restoreEntry(mk('c', '2026-03-01T00:00:00.000Z'));
    await restoreEntry(mk('b', '2026-02-01T00:00:00.000Z'));
    expect((await listEntries()).map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });

  it('deleteEntry and restoreEntry round-trip verbatim', async () => {
    const entry = await createEntry(makeForm(), 'library');
    await updateAnswers(entry.id, { f1: 'x' });
    const before = (await getEntry(entry.id))!;
    await deleteEntry(entry.id);
    expect(await getEntry(entry.id)).toBeUndefined();
    await restoreEntry(before);
    expect(await getEntry(entry.id)).toEqual(before);
  });

  it('deleteEntries removes several', async () => {
    const a = await createEntry(makeForm(), 'own');
    const b = await createEntry(makeForm(), 'own');
    const c = await createEntry(makeForm(), 'own');
    await deleteEntries([a.id, b.id]);
    expect((await listEntries()).map((e) => e.id)).toEqual([c.id]);
  });
});
