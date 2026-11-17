import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { deleteForm, getForm, listForms, putForms, saveForm } from './forms';
import { makeForm } from './testUtils';

beforeEach(async () => {
  await db.forms.clear();
});

describe('forms', () => {
  it('saveForm sets updatedAt and persists', async () => {
    const saved = await saveForm(makeForm());
    expect(saved.updatedAt > '2026-01-01T00:00:00.000Z').toBe(true);
    expect(await getForm('form-1')).toEqual(saved);
  });

  it('putForms stores many verbatim; listForms and deleteForm work', async () => {
    await putForms([makeForm({ id: 'a' }), makeForm({ id: 'b' })]);
    expect((await listForms()).map((f) => f.id).sort()).toEqual(['a', 'b']);
    await deleteForm('a');
    expect(await getForm('a')).toBeUndefined();
  });
});
