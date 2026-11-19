import type { Form } from './form.ts';

// Kept apart from formFile.ts so that exporting does not pull Zod into the first-load chunk.
export const CURRENT_SCHEMA_VERSION = 1;

/** Indented for files people may open; `compact` for share links, where every character counts. */
export function serializeFormFile(forms: Form[], options: { compact?: boolean } = {}): string {
  return JSON.stringify(
    { schemaVersion: CURRENT_SCHEMA_VERSION, forms },
    null,
    options.compact ? undefined : 2,
  );
}
