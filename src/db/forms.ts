import type { Form } from '../schema/form';
import { db } from './db';

export function listForms(): Promise<Form[]> {
  return db.forms.toArray();
}

export function getForm(id: string): Promise<Form | undefined> {
  return db.forms.get(id);
}

/** Stores the form with `updatedAt` set to now; returns the stored form. */
export async function saveForm(form: Form): Promise<Form> {
  const saved = { ...form, updatedAt: new Date().toISOString() };
  await db.forms.put(saved);
  return saved;
}

export function deleteForm(id: string): Promise<void> {
  return db.forms.delete(id);
}

/** Bulk store verbatim (import); atomic. */
export async function putForms(forms: Form[]): Promise<void> {
  await db.forms.bulkPut(forms);
}
