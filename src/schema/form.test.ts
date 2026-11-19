import { describe, expect, it } from 'vitest';
import { fieldSchema, formSchema, LIMITS } from './form';

const base = { id: 'f1', required: false };

describe('fieldSchema', () => {
  it('rejects singleChoice without options', () => {
    const r = fieldSchema.safeParse({
      ...base,
      type: 'singleChoice',
      options: { choices: [], display: 'radio' },
    });
    expect(r.success).toBe(false);
  });

  it('rejects heading with required: true', () => {
    const r = fieldSchema.safeParse({
      id: 'h',
      type: 'heading',
      required: true,
      options: { text: 'Title' },
    });
    expect(r.success).toBe(false);
  });

  it('accepts heading with required: false', () => {
    const r = fieldSchema.safeParse({
      id: 'h',
      type: 'heading',
      required: false,
      options: { text: 'Title' },
    });
    expect(r.success).toBe(true);
  });

  it('drops a label on heading (old files stay loadable)', () => {
    const r = fieldSchema.safeParse({
      id: 'h',
      type: 'heading',
      label: 'Old label',
      required: false,
      options: { text: 'Title' },
    });
    expect(r.success).toBe(true);
    expect(r.data).not.toHaveProperty('label');
  });

  it('accepts yesNo without display (older files) and rejects an unknown display', () => {
    const yesNo = { ...base, type: 'yesNo', options: { yesLabel: 'Ja', noLabel: 'Nein' } };
    expect(fieldSchema.safeParse(yesNo).success).toBe(true);
    const chips = { ...yesNo, options: { ...yesNo.options, display: 'chips' } };
    expect(fieldSchema.safeParse(chips).success).toBe(true);
    const bad = { ...yesNo, options: { ...yesNo.options, display: 'checkbox' } };
    expect(fieldSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects date.min with an invalid fixed date', () => {
    const r = fieldSchema.safeParse({
      ...base,
      type: 'date',
      options: { min: { kind: 'fixed', date: '2026-13-01' } },
    });
    expect(r.success).toBe(false);
  });

  it('rejects non-existent calendar day 2026-02-30', () => {
    const r = fieldSchema.safeParse({
      ...base,
      type: 'date',
      options: { max: { kind: 'fixed', date: '2026-02-30' } },
    });
    expect(r.success).toBe(false);
  });

  it('accepts valid date bounds and weekdays', () => {
    const r = fieldSchema.safeParse({
      ...base,
      type: 'date',
      options: {
        min: { kind: 'fixed', date: '2026-02-28' },
        max: { kind: 'relative', days: 3 },
        disabledWeekdays: [0, 6],
      },
    });
    expect(r.success).toBe(true);
  });

  it('rejects disabledWeekdays outside 0-6', () => {
    const r = fieldSchema.safeParse({
      ...base,
      type: 'date',
      options: { disabledWeekdays: [7] },
    });
    expect(r.success).toBe(false);
  });

  it('validates time format HH:mm', () => {
    const ok = fieldSchema.safeParse({
      ...base,
      type: 'time',
      options: { min: '00:00', max: '23:59' },
    });
    const bad = fieldSchema.safeParse({ ...base, type: 'time', options: { min: '24:00' } });
    expect(ok.success).toBe(true);
    expect(bad.success).toBe(false);
  });

  it('rejects empty field id', () => {
    const r = fieldSchema.safeParse({
      id: '',
      type: 'yesNo',
      required: false,
      options: { yesLabel: 'a', noLabel: 'b' },
    });
    expect(r.success).toBe(false);
  });

  it('rejects duplicate choice option ids', () => {
    const r = fieldSchema.safeParse({
      ...base,
      type: 'multipleChoice',
      options: {
        choices: [
          { id: 'a', label: 'A' },
          { id: 'a', label: 'B' },
        ],
      },
    });
    expect(r.success).toBe(false);
  });

  it('rejects minSelected > maxSelected', () => {
    const r = fieldSchema.safeParse({
      ...base,
      type: 'multipleChoice',
      options: { choices: [{ id: 'a', label: 'A' }], minSelected: 2, maxSelected: 1 },
    });
    expect(r.success).toBe(false);
  });

  it('accepts chips display for singleChoice and multipleChoice', () => {
    const choices = [{ id: 'a', label: 'A' }];
    expect(
      fieldSchema.safeParse({
        ...base,
        type: 'singleChoice',
        options: { choices, display: 'chips' },
      }).success,
    ).toBe(true);
    expect(
      fieldSchema.safeParse({
        ...base,
        type: 'multipleChoice',
        options: { choices, display: 'chips' },
      }).success,
    ).toBe(true);
    expect(
      fieldSchema.safeParse({
        ...base,
        type: 'multipleChoice',
        options: { choices, display: 'checkbox' },
      }).success,
    ).toBe(true);
  });

  it('keeps multipleChoice without display valid', () => {
    const r = fieldSchema.safeParse({
      ...base,
      type: 'multipleChoice',
      options: { choices: [{ id: 'a', label: 'A' }] },
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown display values', () => {
    const choices = [{ id: 'a', label: 'A' }];
    expect(
      fieldSchema.safeParse({ ...base, type: 'singleChoice', options: { choices, display: 'x' } })
        .success,
    ).toBe(false);
    expect(
      fieldSchema.safeParse({ ...base, type: 'multipleChoice', options: { choices, display: 'x' } })
        .success,
    ).toBe(false);
    expect(
      fieldSchema.safeParse({
        ...base,
        type: 'multipleChoice',
        options: { choices, display: 'radio' },
      }).success,
    ).toBe(false);
  });
});

describe('formSchema', () => {
  const form = {
    id: 'form1',
    title: 'T',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-02T10:00:00.000Z',
    fields: [],
  };

  it('accepts a minimal form', () => {
    expect(formSchema.safeParse(form).success).toBe(true);
  });

  it('rejects non-ISO createdAt', () => {
    expect(formSchema.safeParse({ ...form, createdAt: 'yesterday' }).success).toBe(false);
  });

  it('rejects duplicate field ids', () => {
    const f = { id: 'x', type: 'yesNo', required: false, options: { yesLabel: 'a', noLabel: 'b' } };
    const r = formSchema.safeParse({ ...form, fields: [f, f] });
    expect(r.success).toBe(false);
  });
});

describe('upper bounds (LIMITS)', () => {
  const formBase = {
    id: 'form',
    title: 'T',
    createdAt: '2026-11-16T10:00:00Z',
    updatedAt: '2026-11-16T10:00:00Z',
  };
  const ok = (field: unknown) => fieldSchema.safeParse(field).success;

  it('caps textarea rows and text maxLength', () => {
    const area = (rows: number) => ({ ...base, type: 'textArea', options: { rows } });
    expect(ok(area(LIMITS.rows))).toBe(true);
    expect(ok(area(LIMITS.rows + 1))).toBe(false);
    expect(ok(area(1e9))).toBe(false);
    const line = (maxLength: number) => ({ ...base, type: 'textLine', options: { maxLength } });
    expect(ok(line(LIMITS.maxLength))).toBe(true);
    expect(ok(line(LIMITS.maxLength + 1))).toBe(false);
  });

  it('caps relative date bounds in both directions', () => {
    const date = (days: number) => ({
      ...base,
      type: 'date',
      options: { min: { kind: 'relative', days } },
    });
    expect(ok(date(LIMITS.relativeDays))).toBe(true);
    expect(ok(date(-LIMITS.relativeDays))).toBe(true);
    expect(ok(date(LIMITS.relativeDays + 1))).toBe(false);
    expect(ok(date(-LIMITS.relativeDays - 1))).toBe(false);
  });

  it('allows stepMinutes 1..720 only', () => {
    const time = (stepMinutes: number) => ({ ...base, type: 'time', options: { stepMinutes } });
    expect(ok(time(1))).toBe(true);
    expect(ok(time(720))).toBe(true);
    expect(ok(time(0))).toBe(false);
    expect(ok(time(721))).toBe(false);
  });

  it('caps choices, fields and text lengths', () => {
    const choices = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `c${i}`, label: `C${i}` }));
    const single = (n: number) => ({
      ...base,
      type: 'singleChoice',
      options: { choices: choices(n), display: 'radio' },
    });
    expect(ok(single(LIMITS.choices))).toBe(true);
    expect(ok(single(LIMITS.choices + 1))).toBe(false);

    const fields = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `f${i}`,
        type: 'heading',
        required: false,
        options: { text: 'x' },
      }));
    expect(formSchema.safeParse({ ...formBase, fields: fields(LIMITS.fields) }).success).toBe(true);
    expect(formSchema.safeParse({ ...formBase, fields: fields(LIMITS.fields + 1) }).success).toBe(
      false,
    );
    const longTitle = 'x'.repeat(LIMITS.shortText + 1);
    expect(formSchema.safeParse({ ...formBase, title: longTitle, fields: [] }).success).toBe(false);
  });
});
