import { NativeSelect, Stack } from '@mantine/core';
import { useT } from '../../../i18n/I18nProvider';
import type { SingleChoiceField } from '../../../schema/form';
import { ChoiceList } from './ChoiceList';

function toDisplay(value: string): SingleChoiceField['options']['display'] {
  return value === 'dropdown' || value === 'chips' ? value : 'radio';
}

export function SingleChoiceOptions(props: {
  options: SingleChoiceField['options'];
  onChange: (options: SingleChoiceField['options']) => void;
}) {
  const t = useT();
  const { options, onChange } = props;
  return (
    <Stack gap="sm">
      <ChoiceList
        choices={options.choices}
        onChange={(choices) => onChange({ ...options, choices })}
      />
      <NativeSelect
        label={t('builder.opt.display')}
        value={options.display}
        data={[
          { value: 'radio', label: t('builder.opt.display.radio') },
          { value: 'dropdown', label: t('builder.opt.display.dropdown') },
          { value: 'chips', label: t('builder.opt.display.chips') },
        ]}
        onChange={(e) =>
          onChange({
            ...options,
            display: toDisplay(e.currentTarget.value),
          })
        }
      />
    </Stack>
  );
}
