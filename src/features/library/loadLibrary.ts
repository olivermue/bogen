import type { Form } from '../../schema/form';
import { parseFormFile } from '../../schema/formFile';

const modules = import.meta.glob('/library/*.json', { import: 'default' });

/** Loads the built-in forms (lazy chunks), re-validated; invalid files are skipped. */
export async function loadLibrary(): Promise<Form[]> {
  const raws = await Promise.all(Object.values(modules).map((load) => load()));
  const forms: Form[] = [];
  const seen = new Set<string>();
  for (const raw of raws) {
    for (const form of parseFormFile(raw).forms) {
      if (seen.has(form.id)) continue;
      seen.add(form.id);
      forms.push(form);
    }
  }
  return forms.sort((a, b) => a.title.localeCompare(b.title));
}

/** New form id and timestamps; field ids and title stay. */
export function copyLibraryForm(form: Form): Form {
  const now = new Date().toISOString();
  return { ...structuredClone(form), id: crypto.randomUUID(), createdAt: now, updatedAt: now };
}
