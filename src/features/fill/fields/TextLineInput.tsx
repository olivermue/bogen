import { TextInput } from '@mantine/core';
import type { TextLineField } from '../../../schema/form';
import type { FieldInputProps } from './types';

export function TextLineInput({
  field,
  value,
  onChange,
  error,
  disabled,
}: FieldInputProps<TextLineField>) {
  const max = field.options.maxLength;
  return (
    <TextInput
      label={field.label}
      description={field.help}
      withAsterisk={field.required}
      placeholder={field.options.placeholder}
      maxLength={max}
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
