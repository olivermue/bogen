import { Group, Radio } from '@mantine/core';
import { useId } from 'react';
import { useT } from '../../../i18n/I18nProvider';
import type { YesNoField } from '../../../schema/form';
import { ChoiceGroup } from './ChoiceGroup';
import { ClearButton } from './ClearButton';
import type { FieldInputProps } from './types';

export function YesNoInput({
  field,
  value,
  onChange,
  error,
  disabled,
}: FieldInputProps<YesNoField>) {
  const t = useT();
  const name = useId();
  const selected = value === true ? 'yes' : value === false ? 'no' : null;
  return (
    <ChoiceGroup
      role="radiogroup"
      label={field.label}
      description={field.help}
      required={field.required}
      error={error}
    >
      <Group gap="md" mt="xs">
        <Radio
          name={name}
          value="yes"
          label={field.options.yesLabel || t('fill.yes')}
          checked={selected === 'yes'}
          onChange={() => onChange(true)}
          disabled={disabled}
        />
        <Radio
          name={name}
          value="no"
          label={field.options.noLabel || t('fill.no')}
          checked={selected === 'no'}
          onChange={() => onChange(false)}
          disabled={disabled}
        />
        {selected !== null && !disabled && <ClearButton onClick={() => onChange(null)} />}
      </Group>
    </ChoiceGroup>
  );
}
