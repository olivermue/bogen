import { Chip, Group, NativeSelect, Radio, Stack } from '@mantine/core';
import { useId } from 'react';
import { useT } from '../../../i18n/I18nProvider';
import type { SingleChoiceField } from '../../../schema/form';
import { ChoiceGroup } from './ChoiceGroup';
import { ClearButton } from './ClearButton';
import type { FieldInputProps } from './types';

export function SingleChoiceInput({
  field,
  value,
  onChange,
  error,
  disabled,
}: FieldInputProps<SingleChoiceField>) {
  const t = useT();
  // Shared `name`: the browser treats the options as one radio group (one tab stop, arrow keys
  // move and select), for radios and for chips alike.
  const name = useId();
  const selected = typeof value === 'string' ? value : '';
  const { choices } = field.options;

  if (field.options.display === 'dropdown') {
    return (
      <NativeSelect
        label={field.label}
        description={field.help}
        withAsterisk={field.required}
        value={selected}
        onChange={(e) => onChange(e.currentTarget.value === '' ? null : e.currentTarget.value)}
        data={[
          { value: '', label: t('fill.choose') },
          ...choices.map((c) => ({ value: c.id, label: c.label })),
        ]}
        error={error}
        disabled={disabled}
      />
    );
  }

  const clear =
    selected !== '' && !disabled ? (
      <div>
        <ClearButton onClick={() => onChange(null)} />
      </div>
    ) : undefined;

  if (field.options.display === 'chips') {
    return (
      <ChoiceGroup
        role="radiogroup"
        label={field.label}
        description={field.help}
        required={field.required}
        error={error}
        after={clear}
      >
        <Chip.Group
          multiple={false}
          value={selected === '' ? null : selected}
          onChange={(v) => onChange(v)}
        >
          <Group gap="xs" mt="xs">
            {choices.map((c) => (
              <Chip key={c.id} value={c.id} name={name} disabled={disabled}>
                {c.label}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      </ChoiceGroup>
    );
  }

  return (
    <ChoiceGroup
      role="radiogroup"
      label={field.label}
      description={field.help}
      required={field.required}
      error={error}
      after={clear}
    >
      <Stack gap="xs" mt="xs">
        {choices.map((c) => (
          <Radio
            key={c.id}
            name={name}
            value={c.id}
            label={c.label}
            checked={selected === c.id}
            onChange={() => onChange(c.id)}
            disabled={disabled}
          />
        ))}
      </Stack>
    </ChoiceGroup>
  );
}
