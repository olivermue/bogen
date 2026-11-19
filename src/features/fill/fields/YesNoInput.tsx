import { useT } from '../../../i18n/I18nProvider';
import type { SingleChoiceField, YesNoField } from '../../../schema/form';
import { SingleChoiceInput } from './SingleChoiceInput';
import type { FieldInputProps } from './types';

/**
 * Yes/no is a single choice out of two: it is shown by SingleChoiceInput with the fixed choice
 * ids "yes"/"no", and the answer stays a boolean.
 */
export function YesNoInput({ field, value, onChange, ...rest }: FieldInputProps<YesNoField>) {
  const t = useT();
  const display = field.options.display ?? 'radio';
  const asChoice: SingleChoiceField = {
    id: field.id,
    type: 'singleChoice',
    label: field.label,
    help: field.help,
    required: field.required,
    options: {
      display,
      choices: [
        { id: 'yes', label: field.options.yesLabel || t('fill.yes') },
        { id: 'no', label: field.options.noLabel || t('fill.no') },
      ],
    },
  };
  return (
    <SingleChoiceInput
      {...rest}
      field={asChoice}
      value={value === true ? 'yes' : value === false ? 'no' : null}
      onChange={(v) => onChange(v === 'yes' ? true : v === 'no' ? false : null)}
      inline={display === 'radio'}
    />
  );
}
