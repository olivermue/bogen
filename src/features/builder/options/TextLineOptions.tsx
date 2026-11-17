import { Stack, TextInput } from '@mantine/core';
import { useT } from '../../../i18n/I18nProvider';
import type { TextLineField } from '../../../schema/form';
import { DraftNumberInput } from './DraftNumberInput';
import { toOptionalText } from './util';

export function TextLineOptions(props: {
  options: TextLineField['options'];
  onChange: (options: TextLineField['options']) => void;
}) {
  const t = useT();
  const { options, onChange } = props;
  return (
    <Stack gap="xs">
      <TextInput
        label={t('builder.opt.placeholder')}
        value={options.placeholder ?? ''}
        onChange={(e) =>
          onChange({ ...options, placeholder: toOptionalText(e.currentTarget.value) })
        }
      />
      <DraftNumberInput
        label={t('builder.opt.maxLength')}
        min={1}
        allowDecimal={false}
        allowNegative={false}
        value={options.maxLength}
        onCommit={(v) => onChange({ ...options, maxLength: v })}
      />
    </Stack>
  );
}
