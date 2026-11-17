import type { Form } from '../../schema/form';
import { parseFormFile, type FormFileError } from '../../schema/formFile';

// Loaded via dynamic import() only when the user imports: keeps Zod out of the first load.

export type ImportError = {
  file: string;
  code: FormFileError['code'];
  index: number | null;
  title?: string;
  path?: string;
};

function titleAt(text: string, index: number): string | undefined {
  try {
    const raw: unknown = JSON.parse(text);
    const forms = (raw as { forms?: unknown }).forms;
    const candidate: unknown = Array.isArray(forms) ? forms[index] : undefined;
    const title = (candidate as { title?: unknown } | null | undefined)?.title;
    return typeof title === 'string' && title ? title : undefined;
  } catch {
    return undefined;
  }
}

/** Parses every file; valid forms are returned even if other forms or files fail. */
export async function readImportFiles(
  files: File[],
): Promise<{ forms: Form[]; errors: ImportError[] }> {
  const forms: Form[] = [];
  const errors: ImportError[] = [];
  for (const file of files) {
    let text: string;
    try {
      text = await file.text();
    } catch {
      errors.push({ file: file.name, code: 'invalidJson', index: null });
      continue;
    }
    const result = parseFormFile(text);
    forms.push(...result.forms);
    for (const e of result.errors) {
      const title = e.index === null ? undefined : titleAt(text, e.index);
      errors.push({
        file: file.name,
        code: e.code,
        index: e.index,
        ...(title ? { title } : {}),
        ...(e.path ? { path: e.path } : {}),
      });
    }
  }
  return { forms, errors };
}
