import { todayLocal } from '../../domain/dates';
import type { Form } from '../../schema/form';
import { serializeFormFile } from '../../schema/serializeFormFile';

// No Zod here: this module is part of the first-load chunk. Parsing lives in readImportFiles.ts.

type CopyTranslate = (key: 'forms.copyTitle', params: { title: string }) => string;

export type ImportPlan = { fresh: Form[]; conflicts: Form[] };

const UMLAUTS: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => UMLAUTS[c] ?? c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'formular';
}

function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportForms(forms: Form[]): void {
  const [only] = forms;
  if (!only) return;
  const filename =
    forms.length === 1 ? `${slugify(only.title)}.json` : `bogen-formulare-${todayLocal()}.json`;
  download(filename, serializeFormFile(forms));
}

export function planImport(existingIds: Set<string>, forms: Form[]): ImportPlan {
  const fresh: Form[] = [];
  const conflicts: Form[] = [];
  for (const form of forms) (existingIds.has(form.id) ? conflicts : fresh).push(form);
  return { fresh, conflicts };
}

/** New form id, localized copy title, fresh timestamps; field ids stay. */
export function asCopy(form: Form, t: CopyTranslate): Form {
  const now = new Date().toISOString();
  return {
    ...structuredClone(form),
    id: crypto.randomUUID(),
    title: t('forms.copyTitle', { title: form.title }),
    createdAt: now,
    updatedAt: now,
  };
}

/** The same id twice in one import set: the first stays, later ones become copies. */
export function dedupeIds(forms: Form[], t: CopyTranslate): Form[] {
  const seen = new Set<string>();
  return forms.map((form) => {
    if (!seen.has(form.id)) {
      seen.add(form.id);
      return form;
    }
    return asCopy(form, t);
  });
}
