import type { AnswerValue, Field } from '../../../schema/form';

export type FieldInputProps<F extends Field> = {
  field: F;
  value: AnswerValue | undefined;
  onChange(v: AnswerValue): void;
  error?: string;
  disabled?: boolean;
};

/** DOM id of a field's wrapper (scroll/focus target). */
export const fieldDomId = (fieldId: string): string => `field-${fieldId}`;
