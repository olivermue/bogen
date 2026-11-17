import { Input } from '@mantine/core';
import { useId, type ReactNode } from 'react';

/**
 * Label, help/hints and error around a group of radios, checkboxes or chips. The group element
 * (`role`) is named by the visible label (`aria-labelledby`) and described by help text and error
 * (`aria-describedby`); `aria-invalid` marks a missing/invalid answer. One wrapper for all choice
 * displays, so chips, radios and checkboxes expose the same semantics.
 */
export function ChoiceGroup(props: {
  role: 'radiogroup' | 'group';
  label?: string;
  description?: ReactNode;
  required?: boolean;
  error?: string;
  children: ReactNode;
  /** Rendered after the group, outside its role element (e.g. the clear button). */
  after?: ReactNode;
}) {
  const { role, label, description, required, error, children, after } = props;
  const id = useId();
  // Mantine's Input.Wrapper derives these ids from `id`.
  const labelId = `${id}-label`;
  const describedBy =
    [error ? `${id}-error` : undefined, description ? `${id}-description` : undefined]
      .filter((part) => part !== undefined)
      .join(' ') || undefined;
  return (
    <Input.Wrapper
      id={id}
      labelElement="div"
      label={label}
      description={description}
      withAsterisk={required}
      error={error}
    >
      <div
        role={role}
        aria-labelledby={label ? labelId : undefined}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        aria-required={role === 'radiogroup' && required ? true : undefined}
      >
        {children}
      </div>
      {after}
    </Input.Wrapper>
  );
}
