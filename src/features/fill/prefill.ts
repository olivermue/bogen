import { todayLocal } from '../../domain/dates';
import type { Answers, Form } from '../../schema/form';
import { isDateAllowed } from './fields/dateRules';

/**
 * Default answers for fields the entry has never stored: date fields with `defaultToday`
 * get local today, unless today is not selectable (disabled weekday, outside min/max) --
 * then the field stays empty. Returns `null` when nothing is added.
 */
export function prefillAnswers(
  form: Form,
  answers: Answers,
  now: Date = new Date(),
): Answers | null {
  const today = todayLocal(now);
  let next: Answers | null = null;
  for (const field of form.fields) {
    if (field.type !== 'date' || !field.options.defaultToday) continue;
    if (Object.hasOwn(answers, field.id)) continue; // also a deliberately cleared (null) answer
    if (!isDateAllowed(field, today, now)) continue;
    next ??= { ...answers };
    next[field.id] = today;
  }
  return next;
}
