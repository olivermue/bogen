import { describe, expect, it } from 'vitest';
import { de } from '../../i18n/de';
import type { MessageKey } from '../../i18n/de';
import { LIMITS, type Field, type Form } from '../../schema/form';
import { validateForm } from './validate';

const t = (key: MessageKey, params?: Record<string, string | number>) =>
  de[key].replace(/\{(\w+)\}/g, (m, name: string) => String(params?.[name] ?? m));

function form(fields: Field[], overrides: Partial<Form> = {}): Form {
  const now = '2026-11-16T10:00:00Z';
  return { id: 'f', title: 'T', createdAt: now, updatedAt: now, fields, ...overrides };
}

describe('validateForm: upper bounds map to i18n messages', () => {
  it('too many rows / relative days / step minutes', () => {
    const result = validateForm(
      form([
        { id: 'a', type: 'textArea', label: 'A', required: false, options: { rows: 1000 } },
        {
          id: 'd',
          type: 'date',
          label: 'D',
          required: false,
          options: { min: { kind: 'relative', days: -5000 } },
        },
        { id: 't', type: 'time', label: 'Z', required: false, options: { stepMinutes: 9999 } },
      ]),
      t,
    );
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.get(0)).toEqual([`Der Wert darf höchstens ${LIMITS.rows} sein.`]);
    expect(result.fieldErrors.get(1)).toEqual([
      `Der Wert muss mindestens ${-LIMITS.relativeDays} sein.`,
    ]);
    expect(result.fieldErrors.get(2)).toEqual([
      `Der Wert darf höchstens ${LIMITS.stepMinutes} sein.`,
    ]);
  });

  it('too many choices, too long label', () => {
    const choices = Array.from({ length: LIMITS.choices + 1 }, (_, i) => ({
      id: `c${i}`,
      label: 'x',
    }));
    const result = validateForm(
      form([
        {
          id: 's',
          type: 'singleChoice',
          label: 'x'.repeat(LIMITS.shortText + 1),
          required: false,
          options: { choices, display: 'radio' },
        },
      ]),
      t,
    );
    expect(result.fieldErrors.get(0)).toEqual([
      `Der Text ist zu lang (höchstens ${LIMITS.shortText} Zeichen).`,
      `Zu viele Optionen (höchstens ${LIMITS.choices}).`,
    ]);
  });

  it('too many fields and too long title / description', () => {
    const fields: Field[] = Array.from({ length: LIMITS.fields + 1 }, (_, i) => ({
      id: `h${i}`,
      type: 'heading',
      required: false,
      options: { text: 'x' },
    }));
    const result = validateForm(
      form(fields, {
        title: 'x'.repeat(LIMITS.shortText + 1),
        description: 'x'.repeat(LIMITS.longText + 1),
      }),
      t,
    );
    expect(result.titleError).toBe(`Der Text ist zu lang (höchstens ${LIMITS.shortText} Zeichen).`);
    expect(result.otherErrors).toEqual([
      `Der Text ist zu lang (höchstens ${LIMITS.longText} Zeichen).`,
      `Zu viele Bausteine (höchstens ${LIMITS.fields}).`,
    ]);
  });
});
