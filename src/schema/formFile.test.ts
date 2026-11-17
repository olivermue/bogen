import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  migrateToCurrent,
  parseFormFile,
  serializeFormFile,
} from './formFile';
import type { Form } from './form';

const nameField: Form['fields'][number] = {
  id: 'name',
  type: 'textLine',
  label: 'Name',
  required: true,
  options: { maxLength: 20 },
};

const validForm: Form = {
  id: 'form-1',
  title: 'Visit',
  description: 'desc',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
  fields: [
    { id: 'h', type: 'heading', required: false, options: { text: 'Head' } },
    nameField,
    {
      id: 'c',
      type: 'singleChoice',
      label: 'Pick',
      required: false,
      options: { choices: [{ id: 'a', label: 'A' }], display: 'radio' },
    },
  ],
};
const validTwoForms = { schemaVersion: 1, forms: [validForm, { ...validForm, id: 'form-2' }] };

describe('parseFormFile', () => {
  it('accepts a valid v1 file with two forms', () => {
    const r = parseFormFile(validTwoForms);
    expect(r.forms).toHaveLength(2);
    expect(r.errors).toEqual([]);
  });

  it('accepts a JSON string', () => {
    expect(parseFormFile(JSON.stringify(validTwoForms)).forms).toHaveLength(2);
  });

  it('reports invalidJson for non-JSON text', () => {
    const r = parseFormFile('{oops');
    expect(r.errors[0]).toMatchObject({ code: 'invalidJson', index: null });
    expect(r.forms).toEqual([]);
  });

  it.each([
    null,
    42,
    'null',
    [],
    {},
    { schemaVersion: 1 },
    { schemaVersion: 1.5, forms: [] },
    { schemaVersion: '1', forms: [] },
    { schemaVersion: 1, forms: {} },
  ])('reports invalidStructure for %j without throwing', (input) => {
    const r = parseFormFile(input);
    expect(r.errors[0]).toMatchObject({ code: 'invalidStructure', index: null });
    expect(r.forms).toEqual([]);
  });

  it('rejects newer schemaVersion', () => {
    const r = parseFormFile({ schemaVersion: 2, forms: [] });
    expect(r.errors[0]).toMatchObject({ code: 'unsupportedVersion', index: null });
  });

  it('rejects schemaVersion below 1 as unsupportedVersion', () => {
    expect(parseFormFile({ schemaVersion: 0, forms: [] }).errors[0]?.code).toBe(
      'unsupportedVersion',
    );
  });

  it('keeps valid forms when one form is invalid', () => {
    const r = parseFormFile({ schemaVersion: 1, forms: [validForm, { title: 42 }] });
    expect(r.forms).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ index: 1, code: 'invalidForm' });
  });

  it('rejects a form with duplicate field ids', () => {
    const dup = { ...validForm, fields: [nameField, nameField] };
    const r = parseFormFile({ schemaVersion: 1, forms: [dup] });
    expect(r.forms).toHaveLength(0);
    expect(r.errors[0]).toMatchObject({ index: 0, code: 'invalidForm' });
    expect(r.errors[0]?.path).toContain('fields');
  });

  it('builds readable paths', () => {
    const bad = {
      ...validForm,
      fields: [
        nameField,
        {
          id: 'z',
          type: 'singleChoice',
          required: false,
          options: { choices: [], display: 'radio' },
        },
      ],
    };
    const r = parseFormFile({ schemaVersion: 1, forms: [bad] });
    expect(r.errors[0]?.path).toBe('fields[1].options.choices');
  });

  it('round-trips serialize -> parse', () => {
    expect(parseFormFile(serializeFormFile([validForm])).forms[0]).toEqual(validForm);
  });

  it('round-trips chips display for single and multiple choice', () => {
    const choices = [{ id: 'a', label: 'A' }];
    const chipsForm: Form = {
      ...validForm,
      fields: [
        { id: 's', type: 'singleChoice', required: false, options: { choices, display: 'chips' } },
        {
          id: 'm',
          type: 'multipleChoice',
          required: false,
          options: { choices, display: 'chips' },
        },
      ],
    };
    expect(parseFormFile(serializeFormFile([chipsForm])).forms[0]).toEqual(chipsForm);
  });

  it('serializes with 2-space indent and current version', () => {
    const s = serializeFormFile([validForm]);
    expect(s).toContain('\n  "schemaVersion": 1');
    expect(JSON.parse(s).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });
});

describe('migrateToCurrent', () => {
  const file = { schemaVersion: 1, forms: [] };

  it('runs steps sequentially from an older version', () => {
    const calls: number[] = [];
    const table = {
      1: (r: unknown) => (calls.push(1), { ...(r as object), a: 1 }),
      2: (r: unknown) => (calls.push(2), { ...(r as object), b: 2 }),
    };
    const r = migrateToCurrent(file, 1, table, 3);
    expect(calls).toEqual([1, 2]);
    expect(r).toEqual({ ok: true, raw: { schemaVersion: 1, forms: [], a: 1, b: 2 } });
  });

  it('reports unsupportedVersion for a missing step', () => {
    const r = migrateToCurrent(file, 1, { 2: (x) => x }, 3);
    expect(r).toMatchObject({ ok: false, error: { code: 'unsupportedVersion', index: null } });
  });

  it('reports invalidStructure for a throwing migration', () => {
    const r = migrateToCurrent(
      file,
      1,
      {
        1: () => {
          throw new Error('boom');
        },
      },
      2,
    );
    expect(r).toMatchObject({ ok: false, error: { code: 'invalidStructure', index: null } });
  });

  it('reports invalidStructure when a migration breaks the envelope', () => {
    const r = migrateToCurrent(file, 1, { 1: () => 'nope' }, 2);
    expect(r).toMatchObject({ ok: false, error: { code: 'invalidStructure' } });
  });

  it('uses the default (empty) table for the current version', () => {
    expect(migrateToCurrent(file, CURRENT_SCHEMA_VERSION)).toEqual({ ok: true, raw: file });
  });
});
