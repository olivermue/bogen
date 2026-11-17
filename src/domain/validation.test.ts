import { describe, expect, it } from 'vitest';
import type { Field, Form } from '../schema/form';
import { isAnswered, missingRequired } from './validation';

const text: Field = { id: 't', type: 'textLine', required: true, options: {} };
const multi: Field = {
  id: 'm',
  type: 'multipleChoice',
  required: true,
  options: { choices: [{ id: 'a', label: 'A' }] },
};
const num: Field = { id: 'n', type: 'number', required: true, options: {} };
const yn: Field = {
  id: 'y',
  type: 'yesNo',
  required: true,
  options: { yesLabel: 'Ja', noLabel: 'Nein' },
};
const heading: Field = { id: 'h', type: 'heading', required: false, options: { text: 'H' } };

describe('isAnswered', () => {
  it('treats whitespace-only text as unanswered', () => {
    expect(isAnswered(text, '   ')).toBe(false);
    expect(isAnswered(text, '')).toBe(false);
    expect(isAnswered(text, ' x ')).toBe(true);
  });
  it('treats empty arrays, null and undefined as unanswered', () => {
    expect(isAnswered(multi, [])).toBe(false);
    expect(isAnswered(multi, ['a'])).toBe(true);
    expect(isAnswered(text, null)).toBe(false);
    expect(isAnswered(text, undefined)).toBe(false);
  });
  it('counts false and 0 as answers', () => {
    expect(isAnswered(yn, false)).toBe(true);
    expect(isAnswered(num, 0)).toBe(true);
  });
  it('never counts headings', () => {
    expect(isAnswered(heading, 'x')).toBe(false);
  });
});

describe('missingRequired', () => {
  const form: Form = {
    id: 'f',
    title: 'F',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    fields: [
      { id: 'a', type: 'textLine', required: true, options: {} },
      { id: 'b', type: 'textLine', required: true, options: {} },
      { id: 'c', type: 'textLine', required: false, options: {} },
      heading,
      { id: 'd', type: 'yesNo', required: true, options: { yesLabel: 'Ja', noLabel: 'Nein' } },
    ],
  };
  it('lists empty required fields only, in form order', () => {
    expect(missingRequired(form, { a: 'x' })).toEqual(['b', 'd']);
    expect(missingRequired(form, { a: 'x', b: 'y', d: false })).toEqual([]);
  });
});
