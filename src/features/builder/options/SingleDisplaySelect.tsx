import { NativeSelect } from '@mantine/core';
import { useT } from '../../../i18n/I18nProvider';
import type { SingleChoiceField } from '../../../schema/form';

export type SingleDisplay = SingleChoiceField['options']['display'];

function toDisplay(value: string): SingleDisplay {
  return value === 'dropdown' || value === 'chips' ? value : 'radio';
}

/** "Darstellung" select for fields with one answer (single choice, yes/no). */
export function SingleDisplaySelect(props: {
  value: SingleDisplay;
  onChange: (display: SingleDisplay) => void;
}) {
  const t = useT();
  return (
    <NativeSelect
      label={t('builder.opt.display')}
      value={props.value}
      data={[
        { value: 'radio', label: t('builder.opt.display.radio') },
        { value: 'dropdown', label: t('builder.opt.display.dropdown') },
        { value: 'chips', label: t('builder.opt.display.chips') },
      ]}
      onChange={(e) => props.onChange(toDisplay(e.currentTarget.value))}
    />
  );
}
