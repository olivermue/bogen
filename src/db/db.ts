import Dexie, { type Table } from 'dexie';
import type { Answers, Form } from '../schema/form';
import type { Settings } from './settings';

export type FormSource = 'own' | 'library';
export type Entry = {
  id: string;
  formId: string;
  formSource: FormSource;
  formSnapshot: Form;
  answers: Answers;
  createdAt: string;
  updatedAt: string;
  sharedAt: string | null;
};
export type SettingsRecord = { key: 'app' } & Settings;

export class BogenDb extends Dexie {
  forms!: Table<Form, string>;
  entries!: Table<Entry, string>;
  settings!: Table<SettingsRecord, 'app'>;

  constructor(name = 'bogen') {
    super(name);
    this.version(1).stores({
      forms: 'id, updatedAt',
      entries: 'id, formId, updatedAt, sharedAt',
      settings: 'key',
    });
  }
}

export const db = new BogenDb();
