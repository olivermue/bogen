import { Group, NativeSelect, Stack } from '@mantine/core';
import { useT } from '../../../i18n/I18nProvider';
import type { MultipleChoiceField } from '../../../schema/form';
import { ChoiceList } from './ChoiceList';
import { DraftNumberInput } from './DraftNumberInput';

export function MultipleChoiceOptions(props: {
  options: MultipleChoiceField['options'];
  onChange: (options: MultipleChoiceField['options']) => void;
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
        value={options.display ?? 'checkbox'}
        data={[
          { value: 'checkbox', label: t('builder.opt.display.checkbox') },
          { value: 'chips', label: t('builder.opt.display.chips') },
        ]}
        onChange={(e) =>
          onChange({
            ...options,
            display: e.currentTarget.value === 'chips' ? 'chips' : 'checkbox',
          })
        }
      />
      <Group grow align="flex-start">
        <DraftNumberInput
          label={t('builder.opt.minSelected')}
          min={0}
          allowDecimal={false}
          allowNegative={false}
          value={options.minSelected}
          onCommit={(v) => onChange({ ...options, minSelected: v })}
        />
        <DraftNumberInput
          label={t('builder.opt.maxSelected')}
          min={0}
          allowDecimal={false}
          allowNegative={false}
          value={options.maxSelected}
          onCommit={(v) => onChange({ ...options, maxSelected: v })}
        />
      </Group>
    </Stack>
  );
}
