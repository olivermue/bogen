import type { MessageKey } from '../../i18n/de';
import { formSchema, type Form } from '../../schema/form';

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

export interface ValidationResult {
  /** Error for the form title, if any. */
  titleError?: string;
  /** Messages per field index in `fields`. */
  fieldErrors: Map<number, string[]>;
  /** Issues not attached to a field or the title. */
  otherErrors: string[];
  ok: boolean;
}

type Message = { key: MessageKey; params?: Record<string, string | number> };
type Issue = {
  path: PropertyKey[];
  code: string;
  origin?: unknown;
  maximum?: unknown;
  minimum?: unknown;
};

/** i18n message for an issue; unmapped issues get a generic translated message (never raw Zod text). */
function messageFor(form: Form, issue: Issue): Message {
  const { path, code } = issue;
  const last = path[path.length - 1];
  const field = typeof path[1] === 'number' ? form.fields[path[1]] : undefined;
  // Upper bounds (LIMITS in src/schema/form.ts).
  if (code === 'too_big') {
    const n = Number(issue.maximum);
    if (issue.origin === 'string') return { key: 'builder.error.tooLong', params: { n } };
    if (last === 'choices') return { key: 'builder.error.tooManyChoices', params: { n } };
    if (path.length === 1 && path[0] === 'fields') {
      return { key: 'builder.error.tooManyFields', params: { n } };
    }
    if (issue.origin === 'number') return { key: 'builder.error.max', params: { n } };
  }
  if (code === 'too_small' && last === 'days') {
    return { key: 'builder.error.min', params: { n: Number(issue.minimum) } };
  }
  if (last === 'choices' && code === 'too_small') return { key: 'builder.error.noChoices' };
  if (last === 'minSelected') return { key: 'builder.error.minMax' };
  if (last === 'date') return { key: 'builder.error.dateInvalid' };
  if (field?.type === 'time' && (last === 'min' || last === 'max')) {
    return { key: 'builder.error.timeInvalid' };
  }
  if (last === 'step' || last === 'stepMinutes' || last === 'maxLength' || last === 'rows') {
    return { key: 'builder.error.positive' };
  }
  return { key: 'builder.error.generic' };
}

/** Validates the whole form with `formSchema` and maps issues to title / field index. */
export function validateForm(form: Form, t: Translate): ValidationResult {
  const fieldErrors = new Map<number, string[]>();
  const otherErrors: string[] = [];
  let titleError = form.title.trim() === '' ? t('builder.error.title') : undefined;

  const parsed = formSchema.safeParse(form);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [root, index] = issue.path;
      const { key, params } = messageFor(form, issue as Issue);
      const message = t(key, params);
      if (root === 'fields' && typeof index === 'number') {
        const list = fieldErrors.get(index) ?? [];
        if (!list.includes(message)) list.push(message);
        fieldErrors.set(index, list);
      } else if (root === 'title') {
        titleError ??= message; // e.g. too long; "empty" is checked above
      } else if (!otherErrors.includes(message)) {
        otherErrors.push(message);
      }
    }
  }
  return {
    titleError,
    fieldErrors,
    otherErrors,
    ok: !titleError && fieldErrors.size === 0 && otherErrors.length === 0,
  };
}
