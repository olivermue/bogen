import { NumberInput } from '@mantine/core';
import { useRef, useState } from 'react';
import { decimalSeparator, parseNumberDraft } from '../../../domain/numbers';
import { useLanguage } from '../../../i18n/I18nProvider';

/**
 * NumberInput that keeps the typed text as a draft ("-", "0,", "1,0") and only commits
 * finite numbers, so partial input is never wiped by a controlled value. Leaving the field
 * shows the last committed number again (or nothing, if that is undefined).
 * `allowEmpty=false`: clearing the input keeps the last committed number.
 * The decimal separator follows the UI language (de `,`, en `.`); the value stays a JS number.
 */
export function DraftNumberInput(props: {
  label: string;
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
  min?: number;
  allowDecimal?: boolean;
  allowNegative?: boolean;
  allowEmpty?: boolean;
}) {
  const { value, onCommit, allowEmpty = true, ...rest } = props;
  const language = useLanguage();
  const [draft, setDraft] = useState<number | string>(value ?? '');
  // Set while the field loses focus: the number formatter then clears a digit-less draft ("-")
  // to "", which must not count as the person emptying the field.
  const blurring = useRef(false);
  const [last, setLast] = useState(value);
  if (value !== last) {
    // External change (e.g. other field edited): adopt it.
    setLast(value);
    setDraft(value ?? '');
  }
  return (
    <NumberInput
      {...rest}
      decimalSeparator={decimalSeparator(language)}
      value={draft}
      onBlurCapture={() => {
        blurring.current = true;
      }}
      onChange={(v) => {
        if (blurring.current && v === '') return;
        setDraft(v);
        const n = parseNumberDraft(v);
        if (n === undefined && !(allowEmpty && v === '')) return;
        setLast(n);
        onCommit(n);
      }}
      onBlur={() => {
        blurring.current = false;
        // Functional update: a clamp on blur (Mantine) may have committed a new number just before.
        setDraft((d) => parseNumberDraft(d) ?? (d === '' && allowEmpty ? '' : (last ?? '')));
      }}
    />
  );
}
