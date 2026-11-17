import { NumberInput, Text } from '@mantine/core';
import { useRef, useState } from 'react';
import { decimalSeparator, parseNumberDraft } from '../../../domain/numbers';
import { useLanguage } from '../../../i18n/I18nProvider';
import type { NumberField } from '../../../schema/form';
import type { FieldInputProps } from './types';

/**
 * Stores numbers as numbers; an emptied input stores `null` (unanswered). Text that is not a
 * number yet (e.g. "-" typed over a selected answer) stays a local draft only: the previous
 * answer remains stored, and leaving the field shows it again. Input that already reads as a
 * number ("1," is 1) is stored at once while the typed text stays visible.
 * The decimal separator follows the UI language (de `,`, en `.`); the answer stays a JS number.
 */
export function NumberFieldInput({
  field,
  value,
  onChange,
  error,
  disabled,
}: FieldInputProps<NumberField>) {
  const language = useLanguage();
  const stored = typeof value === 'number' ? value : undefined;
  const [draft, setDraft] = useState<number | string>(stored ?? '');
  // Set while the field loses focus: the number formatter then clears a digit-less draft ("-")
  // to "", which must not count as the person emptying the field.
  const blurring = useRef(false);
  const [last, setLast] = useState(stored);
  if (stored !== last) {
    // External change: adopt it.
    setLast(stored);
    setDraft(stored ?? '');
  }
  const { min, max, step, unit } = field.options;
  return (
    <NumberInput
      label={field.label}
      description={field.help}
      withAsterisk={field.required}
      min={min}
      max={max}
      step={step}
      hideControls
      decimalSeparator={decimalSeparator(language)}
      rightSection={
        unit ? (
          <Text size="sm" c="dimmed" pr="xs">
            {unit}
          </Text>
        ) : undefined
      }
      rightSectionWidth={unit ? 'auto' : undefined}
      rightSectionPointerEvents="none"
      value={draft}
      onBlurCapture={() => {
        blurring.current = true;
      }}
      onChange={(v) => {
        if (blurring.current && v === '') return;
        setDraft(v);
        const n = parseNumberDraft(v);
        if (n === undefined) {
          if (v === '') {
            setLast(undefined);
            onChange(null);
          }
          return;
        }
        setLast(n);
        onChange(n);
      }}
      onBlur={() => {
        blurring.current = false;
        // Functional update: a clamp on blur (Mantine) may have stored a new number just before.
        setDraft((d) => parseNumberDraft(d) ?? (d === '' ? '' : (last ?? '')));
      }}
      error={error}
      disabled={disabled}
    />
  );
}
