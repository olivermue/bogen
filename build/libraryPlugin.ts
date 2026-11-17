import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { parseFormFile, type FormFileError } from '../src/schema/formFile.ts';

export type LibraryFileErrors = { file: string; errors: FormFileError[] };

/** Validates every `*.json` in `dir`; returns only files with errors. */
export function validateLibraryDir(dir: string): LibraryFileErrors[] {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort();
  const result: LibraryFileErrors[] = [];
  const seenIds = new Map<string, string>();
  for (const file of files) {
    const { forms, errors } = parseFormFile(readFileSync(join(dir, file), 'utf8'));
    const all = [...errors];
    forms.forEach((form, index) => {
      const first = seenIds.get(form.id);
      if (first !== undefined) {
        all.push({
          index,
          code: 'invalidForm',
          path: 'id',
          message: `Duplicate form id "${form.id}" (first used in ${first})`,
        });
      } else {
        seenIds.set(form.id, file);
      }
    });
    if (all.length > 0) result.push({ file, errors: all });
  }
  return result;
}

export function bogenLibraryPlugin(dir = 'library'): Plugin {
  return {
    name: 'bogen-library',
    buildStart() {
      const problems = validateLibraryDir(dir);
      if (problems.length === 0) return;
      const lines = problems.flatMap(({ file, errors }) =>
        errors.map((e) => {
          const where = e.index === null ? '' : `forms[${e.index}]`;
          const path = [where, e.path].filter(Boolean).join('.');
          return `${dir}/${file}${path ? ` @ ${path}` : ''}: ${e.message}`;
        }),
      );
      this.error(`Invalid form library:\n${lines.join('\n')}`);
    },
  };
}
