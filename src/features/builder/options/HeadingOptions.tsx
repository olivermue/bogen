import { TextInput } from '@mantine/core';
import { useT } from '../../../i18n/I18nProvider';
import type { HeadingField } from '../../../schema/form';

export function HeadingOptions(props: {
  options: HeadingField['options'];
  onChange: (options: HeadingField['options']) => void;
}) {
  const t = useT();
  return (
    <TextInput
      label={t('builder.opt.headingText')}
      value={props.options.text}
      onChange={(e) => props.onChange({ text: e.currentTarget.value })}
    />
  );
}
