import type { Form } from './form.ts';

// Kept apart from formFile.ts so that exporting does not pull Zod into the first-load chunk.
export const CURRENT_SCHEMA_VERSION = 1;

export function serializeFormFile(forms: Form[]): string {
  return JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, forms }, null, 2);
}
