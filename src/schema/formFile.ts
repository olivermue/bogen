import { formSchema, type Form } from './form.ts';
import { CURRENT_SCHEMA_VERSION } from './serializeFormFile.ts';

export { CURRENT_SCHEMA_VERSION, serializeFormFile } from './serializeFormFile.ts';

export type FormFileError = {
  /** Index of the form in the file, or null for whole-file errors. */
  index: number | null;
  code: 'invalidJson' | 'invalidStructure' | 'unsupportedVersion' | 'invalidForm';
  /** Readable path such as `fields[2].options.choices`. */
  path?: string;
  /** Technical (English) message; the UI maps `code` + `path` to i18n text. */
  message: string;
};

/** Migrations from version v to v + 1. Initially empty. */
export const migrations: Record<number, (raw: unknown) => unknown> = {};

export function formatPath(path: readonly PropertyKey[]): string {
  let out = '';
  for (const part of path) {
    if (typeof part === 'number') out += `[${part}]`;
    else out += out ? `.${String(part)}` : String(part);
  }
  return out;
}

const fileError = (
  code: FormFileError['code'],
  message: string,
): { forms: Form[]; errors: FormFileError[] } => ({
  forms: [],
  errors: [{ index: null, code, message }],
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type MigrationResult = { ok: true; raw: unknown } | { ok: false; error: FormFileError };

/** Runs migrations step by step from `fromVersion` to `current`. Exported for tests. */
export function migrateToCurrent(
  raw: unknown,
  fromVersion: number,
  table: Record<number, (raw: unknown) => unknown> = migrations,
  current: number = CURRENT_SCHEMA_VERSION,
): MigrationResult {
  const fail = (code: FormFileError['code'], message: string): MigrationResult => ({
    ok: false,
    error: { index: null, code, message },
  });
  if (fromVersion > current) {
    return fail(
      'unsupportedVersion',
      `schemaVersion ${fromVersion} is newer than supported version ${current}`,
    );
  }
  let version = fromVersion;
  let value = raw;
  while (version < current) {
    const migrate = table[version];
    if (!migrate)
      return fail('unsupportedVersion', `No migration available from schemaVersion ${version}`);
    try {
      value = migrate(value);
    } catch (e) {
      return fail(
        'invalidStructure',
        `Migration from schemaVersion ${version} failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    version += 1;
    if (!isRecord(value) || !Array.isArray(value.forms)) {
      return fail(
        'invalidStructure',
        `Migration to schemaVersion ${version} produced an invalid file`,
      );
    }
  }
  return { ok: true, raw: value };
}

export function parseFormFile(input: string | unknown): { forms: Form[]; errors: FormFileError[] } {
  try {
    return parseUnsafe(input);
  } catch (e) {
    return fileError(
      'invalidStructure',
      `Unexpected error: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

function parseUnsafe(input: unknown): { forms: Form[]; errors: FormFileError[] } {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch (e) {
      return fileError(
        'invalidJson',
        `Not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  if (!isRecord(raw) || !Number.isInteger(raw.schemaVersion) || !Array.isArray(raw.forms)) {
    return fileError(
      'invalidStructure',
      'Expected an object { schemaVersion: integer, forms: array }',
    );
  }

  const migrated = migrateToCurrent(raw, raw.schemaVersion as number);
  if (!migrated.ok) return { forms: [], errors: [migrated.error] };
  raw = migrated.raw;

  const rawForms = (raw as { forms: unknown[] }).forms;
  const forms: Form[] = [];
  const errors: FormFileError[] = [];
  rawForms.forEach((candidate, index) => {
    const result = formSchema.safeParse(candidate);
    if (result.success) {
      forms.push(result.data);
      return;
    }
    const issue = result.error.issues[0];
    const path = issue ? formatPath(issue.path) : '';
    errors.push({
      index,
      code: 'invalidForm',
      ...(path ? { path } : {}),
      message: issue?.message ?? 'Invalid form',
    });
  });
  return { forms, errors };
}
