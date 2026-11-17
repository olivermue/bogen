import type { Answers, AnswerValue, Field, Form } from '../schema/form';

/** Whether a value counts as an answer. `false` and `0` do; headings never. */
export function isAnswered(field: Field, value: AnswerValue | undefined): boolean {
  if (field.type === 'heading') return false;
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return true; // boolean
}

/** IDs of required, unanswered fields in form order. */
export function missingRequired(form: Form, answers: Answers): string[] {
  return form.fields.filter((f) => f.required && !isAnswered(f, answers[f.id])).map((f) => f.id);
}
