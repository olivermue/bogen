import { Group, Stack, TextInput } from '@mantine/core';
import { useT } from '../../../i18n/I18nProvider';
import type { TimeField } from '../../../schema/form';
import { DraftNumberInput } from './DraftNumberInput';
import { toOptionalText } from './util';

export function TimeOptions(props: {
  options: TimeField['options'];
  onChange: (options: TimeField['options']) => void;
}) {
  const t = useT();
  const { options, onChange } = props;
  return (
    <Stack gap="xs">
      <Group grow align="flex-start">
        <TextInput
          type="time"
          label={t('builder.opt.timeMin')}
          value={options.min ?? ''}
          onChange={(e) => onChange({ ...options, min: toOptionalText(e.currentTarget.value) })}
        />
        <TextInput
          type="time"
          label={t('builder.opt.timeMax')}
          value={options.max ?? ''}
          onChange={(e) => onChange({ ...options, max: toOptionalText(e.currentTarget.value) })}
        />
      </Group>
      <DraftNumberInput
        label={t('builder.opt.stepMinutes')}
        min={1}
        allowDecimal={false}
        allowNegative={false}
        value={options.stepMinutes}
        onCommit={(v) => onChange({ ...options, stepMinutes: v })}
      />
    </Stack>
  );
}
