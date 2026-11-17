import { afterEach, describe, expect, it, vi } from 'vitest';
import { de } from '../../i18n/de';
import { en } from '../../i18n/en';
import type { Form } from '../../schema/form';
import { asCopy, dedupeIds, exportForms, planImport, slugify } from './importExport';

const form = (id: string, title = 'T'): Form => ({
  id,
  title,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
  fields: [
    { id: 'f1', type: 'yesNo', required: false, options: { yesLabel: 'Ja', noLabel: 'Nein' } },
  ],
});

const tDe = (key: 'forms.copyTitle', params: { title: string }) =>
  de[key].replace('{title}', params.title);
const tEn = (key: 'forms.copyTitle', params: { title: string }) =>
  en[key].replace('{title}', params.title);

describe('slugify', () => {
  it('transliterates umlauts and sharp s', () => {
    expect(slugify('Übung für Größe')).toBe('uebung-fuer-groesse');
  });
  it('reduces everything else to [a-z0-9-]', () => {
    expect(slugify('  Hallo,   Welt! 2026 ')).toBe('hallo-welt-2026');
    expect(slugify('--a--b--')).toBe('a-b');
  });
  it('falls back when nothing is left', () => {
    expect(slugify('???')).toBe('formular');
    expect(slugify('')).toBe('formular');
  });
});

describe('planImport', () => {
  it('separates fresh forms from id conflicts', () => {
    const plan = planImport(new Set(['a']), [form('a'), form('b')]);
    expect(plan.fresh.map((f) => f.id)).toEqual(['b']);
    expect(plan.conflicts.map((f) => f.id)).toEqual(['a']);
  });
});

describe('asCopy', () => {
  it('uses a new id, keeps field ids, localizes the title and refreshes timestamps', () => {
    const original = form('a', 'Bogen');
    const copy = asCopy(original, tDe);
    expect(copy.id).not.toBe('a');
    expect(copy.title).toBe('Bogen (Kopie)');
    expect(asCopy(original, tEn).title).toBe('Bogen (copy)');
    expect(copy.fields.map((f) => f.id)).toEqual(['f1']);
    expect(copy.createdAt).not.toBe(original.createdAt);
    expect(copy.updatedAt).toBe(copy.createdAt);
    expect(original.title).toBe('Bogen');
  });
});

describe('dedupeIds', () => {
  it('keeps the first form and turns later same-id forms into copies', () => {
    const out = dedupeIds([form('a', 'X'), form('a', 'Y'), form('b')], tDe);
    expect(out).toHaveLength(3);
    expect(out[0]?.id).toBe('a');
    expect(new Set(out.map((f) => f.id)).size).toBe(3);
    expect(out[1]?.title).toBe('Y (Kopie)');
  });
});

describe('exportForms', () => {
  const downloads: string[] = [];
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    downloads.length = 0;
    delete (URL as unknown as Record<string, unknown>).createObjectURL;
    delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
  });
  function setup() {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:x' });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
  }

  it('names a single form after its slug', () => {
    setup();
    exportForms([form('a', 'Übung')]);
    expect(downloads).toEqual(['uebung.json']);
  });

  it('names several forms with the LOCAL date', () => {
    setup();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 0, 30));
    exportForms([form('a'), form('b')]);
    expect(downloads).toEqual(['bogen-formulare-2026-01-01.json']);
  });
});
