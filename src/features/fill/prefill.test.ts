import { describe, expect, it } from 'vitest';
import type { DateField, Form } from '../../schema/form';
import { prefillAnswers } from './prefill';

// 2026-11-01 is a Sunday.
const NIGHT = new Date(2026, 10, 1, 0, 30);

function formWith(options: DateField['options']): Form {
  return {
    id: 'f',
    title: 'T',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    fields: [{ id: 'd', type: 'date', required: false, options }],
  };
}

describe('prefillAnswers', () => {
  it('fills local today for defaultToday', () => {
    expect(prefillAnswers(formWith({ defaultToday: true }), {}, NIGHT)).toEqual({
      d: '2026-11-01',
    });
  });

  it('does nothing without defaultToday', () => {
    expect(prefillAnswers(formWith({}), {}, NIGHT)).toBeNull();
  });

  it('keeps an existing or deliberately cleared answer', () => {
    const form = formWith({ defaultToday: true });
    expect(prefillAnswers(form, { d: '2026-10-01' }, NIGHT)).toBeNull();
    expect(prefillAnswers(form, { d: null }, NIGHT)).toBeNull();
  });

  it('leaves the field empty when today is a disabled weekday', () => {
    expect(
      prefillAnswers(formWith({ defaultToday: true, disabledWeekdays: [0] }), {}, NIGHT),
    ).toBeNull();
  });

  it('leaves the field empty when today is outside min/max', () => {
    const tomorrow = { kind: 'relative', days: 1 } as const;
    const yesterday = { kind: 'relative', days: -1 } as const;
    expect(prefillAnswers(formWith({ defaultToday: true, min: tomorrow }), {}, NIGHT)).toBeNull();
    expect(prefillAnswers(formWith({ defaultToday: true, max: yesterday }), {}, NIGHT)).toBeNull();
    expect(
      prefillAnswers(
        formWith({ defaultToday: true, min: { kind: 'fixed', date: '2026-11-01' } }),
        {},
        NIGHT,
      ),
    ).toEqual({ d: '2026-11-01' });
  });
});
