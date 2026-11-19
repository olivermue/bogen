import { describe, expect, it } from 'vitest';
import type { Form } from '../../schema/form';
import { parseFormFile } from '../../schema/formFile';
import {
  LINK_VERSION,
  MAX_LINK_LENGTH,
  buildFormLink,
  decodeFormPayload,
  encodeFormPayload,
} from './formLink';

const form: Form = {
  id: 'a1',
  title: 'Krankmeldung – Größe äöü 🙂',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
  fields: [
    { id: 'f1', type: 'yesNo', required: false, options: { yesLabel: 'Ja', noLabel: 'Nein' } },
    { id: 'f2', type: 'textLine', required: true, options: {} },
  ],
};

describe('formLink', () => {
  it('round-trips a form through payload encoding', async () => {
    const payload = await encodeFormPayload(form);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    const text = await decodeFormPayload(payload);
    expect(parseFormFile(text)).toEqual({ forms: [form], errors: [] });
  });

  it('builds a hash-route link on the given base and drops an existing fragment', async () => {
    const link = await buildFormLink(form, 'https://example.org/bogen/#/forms');
    expect(link).toMatch(
      new RegExp(`^https://example\\.org/bogen/#/import\\?v=${LINK_VERSION}&d=[A-Za-z0-9_-]+$`),
    );
    const d = new URL(link.replace('#/import', '')).searchParams.get('d')!;
    expect(parseFormFile(await decodeFormPayload(d)).forms).toEqual([form]);
  });

  it('compresses: the link is shorter than the plain JSON', async () => {
    const big: Form = {
      ...form,
      fields: Array.from({ length: 40 }, (_, i) => ({
        id: `f${i}`,
        type: 'textLine' as const,
        required: false,
        label: `Frage Nummer ${i}`,
        options: {},
      })),
    };
    const link = await buildFormLink(big, 'https://example.org/');
    expect(link.length).toBeLessThan(JSON.stringify(big).length / 2);
    expect(link.length).toBeLessThan(MAX_LINK_LENGTH);
  });

  it('rejects damaged payloads', async () => {
    await expect(decodeFormPayload('not*base64')).rejects.toThrow();
    const payload = await encodeFormPayload(form);
    await expect(decodeFormPayload(payload.slice(0, payload.length / 2))).rejects.toThrow();
  });
});
