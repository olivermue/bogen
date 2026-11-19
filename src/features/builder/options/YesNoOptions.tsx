import { Group, Stack, TextInput } from '@mantine/core';
import { useT } from '../../../i18n/I18nProvider';
import type { YesNoField } from '../../../schema/form';
import { SingleDisplaySelect } from './SingleDisplaySelect';

export function YesNoOptions(props: {
  options: YesNoField['options'];
  onChange: (options: YesNoField['options']) => void;
}) {
  const t = useT();
  const { options, onChange } = props;
  return (
    <Stack gap="sm">
      <Group grow align="flex-start">
        <TextInput
          label={t('builder.opt.yesLabel')}
          value={options.yesLabel}
          onChange={(e) => onChange({ ...options, yesLabel: e.currentTarget.value })}
        />
        <TextInput
          label={t('builder.opt.noLabel')}
          value={options.noLabel}
          onChange={(e) => onChange({ ...options, noLabel: e.currentTarget.value })}
        />
      </Group>
      <SingleDisplaySelect
        value={options.display ?? 'radio'}
        onChange={(display) => onChange({ ...options, display })}
      />
    </Stack>
  );
}
