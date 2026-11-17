import { Stack } from '@mantine/core';
import type { Answers, AnswerValue, Field } from '../../../schema/form';
import { DateFieldInput, TimeFieldInput } from './DateTimeFields';
import { HeadingBlock } from './HeadingBlock';
import { MultipleChoiceInput } from './MultipleChoiceInput';
import { NumberFieldInput } from './NumberFieldInput';
import { SingleChoiceInput } from './SingleChoiceInput';
import { TextAreaInput } from './TextAreaInput';
import { TextLineInput } from './TextLineInput';
import { fieldDomId, type FieldInputProps } from './types';
import { YesNoInput } from './YesNoInput';

/** Renders the input component matching `field.type`. */
export function FieldInput(props: FieldInputProps<Field>) {
  const { field, ...rest } = props;
  switch (field.type) {
    case 'textLine':
      return <TextLineInput field={field} {...rest} />;
    case 'textArea':
      return <TextAreaInput field={field} {...rest} />;
    case 'singleChoice':
      return <SingleChoiceInput field={field} {...rest} />;
    case 'multipleChoice':
      return <MultipleChoiceInput field={field} {...rest} />;
    case 'date':
      return <DateFieldInput field={field} {...rest} />;
    case 'time':
      return <TimeFieldInput field={field} {...rest} />;
    case 'number':
      return <NumberFieldInput field={field} {...rest} />;
    case 'yesNo':
      return <YesNoInput field={field} {...rest} />;
    case 'heading':
      return <HeadingBlock field={field} />;
  }
}

/**
 * All fields of a form. Shared by the fill page and the builder preview (`disabled`).
 * Holds no state and does not save anything.
 */
export function FormFields(props: {
  fields: Field[];
  answers: Answers;
  errors?: ReadonlyMap<string, string>;
  onChange?: (fieldId: string, value: AnswerValue) => void;
  disabled?: boolean;
}) {
  const { fields, answers, errors, onChange, disabled } = props;
  return (
    <Stack gap="lg">
      {fields.map((field) => (
        <div key={field.id} id={fieldDomId(field.id)}>
          <FieldInput
            field={field}
            value={answers[field.id]}
            onChange={(v) => onChange?.(field.id, v)}
            error={errors?.get(field.id)}
            disabled={disabled}
          />
        </div>
      ))}
    </Stack>
  );
}
