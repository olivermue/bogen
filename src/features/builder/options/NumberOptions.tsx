import { Group, Stack, TextInput } from '@mantine/core';
import { useT } from '../../../i18n/I18nProvider';
import type { NumberField } from '../../../schema/form';
import { DraftNumberInput } from './DraftNumberInput';
import { toOptionalText } from './util';

export function NumberOptions(props: {
  options: NumberField['options'];
  onChange: (options: NumberField['options']) => void;
}) {
  const t = useT();
  const { options, onChange } = props;
  return (
    <Stack gap="xs">
      <Group grow align="flex-start">
        <DraftNumberInput
          label={t('builder.opt.numberMin')}
          value={options.min}
          onCommit={(v) => onChange({ ...options, min: v })}
        />
        <DraftNumberInput
          label={t('builder.opt.numberMax')}
          value={options.max}
          onCommit={(v) => onChange({ ...options, max: v })}
        />
      </Group>
      <Group grow align="flex-start">
        <DraftNumberInput
          label={t('builder.opt.step')}
          min={0.001}
          value={options.step}
          onCommit={(v) => onChange({ ...options, step: v })}
        />
        <TextInput
          label={t('builder.opt.unit')}
          value={options.unit ?? ''}
          onChange={(e) => onChange({ ...options, unit: toOptionalText(e.currentTarget.value) })}
        />
      </Group>
    </Stack>
  );
}
