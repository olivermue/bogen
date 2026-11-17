import { Textarea } from '@mantine/core';
import type { TextAreaField } from '../../../schema/form';
import type { FieldInputProps } from './types';

export function TextAreaInput({
  field,
  value,
  onChange,
  error,
  disabled,
}: FieldInputProps<TextAreaField>) {
  const max = field.options.maxLength;
  return (
    <Textarea
      label={field.label}
      description={field.help}
      withAsterisk={field.required}
      placeholder={field.options.placeholder}
      maxLength={max}
      autosize
      minRows={field.options.rows ?? 3}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => {
        const text = e.currentTarget.value;
        onChange(max !== undefined ? text.slice(0, max) : text);
      }}
      error={error}
      disabled={disabled}
    />
  );
}
