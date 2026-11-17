import { isAnswered, missingRequired } from '../../domain/validation';
import type { MessageKey } from '../../i18n/de';
import type { Answers, Form } from '../../schema/form';

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

/**
 * Errors that block copy/share, keyed by field id, in form order:
 * - required fields without an answer;
 * - multiple-choice fields that are answered but have fewer than `minSelected` choices
 *   (an unanswered optional field is fine, it is simply left out of the output).
 */
export function validateAnswers(form: Form, answers: Answers, t: Translate): Map<string, string> {
  const missing = new Set(missingRequired(form, answers));
  const errors = new Map<string, string>();
  for (const field of form.fields) {
    if (missing.has(field.id)) {
      errors.set(field.id, t('fill.error.required'));
      continue;
    }
    if (field.type !== 'multipleChoice') continue;
    const min = field.options.minSelected;
    const value = answers[field.id];
    if (
      min !== undefined &&
      isAnswered(field, value) &&
      Array.isArray(value) &&
      value.length < min
    ) {
      errors.set(field.id, t('fill.error.minSelected', { n: min }));
    }
  }
  return errors;
}
