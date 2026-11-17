import { Checkbox, Chip, Group, Stack, Text } from '@mantine/core';
import { useT } from '../../../i18n/I18nProvider';
import type { MultipleChoiceField } from '../../../schema/form';
import { ChoiceGroup } from './ChoiceGroup';
import type { FieldInputProps } from './types';

/**
 * `maxSelected` is enforced (further boxes are disabled once reached); `minSelected` is shown
 * as a hint and checked before copy/share (see validateAnswers).
 */
export function MultipleChoiceInput({
  field,
  value,
  onChange,
  error,
  disabled,
}: FieldInputProps<MultipleChoiceField>) {
  const t = useT();
  const selected = Array.isArray(value) ? value : [];
  const { choices, minSelected, maxSelected } = field.options;
  const limit = maxSelected !== undefined && maxSelected > 0 ? maxSelected : undefined;
  const full = limit !== undefined && selected.length >= limit;
  const hints = [
    minSelected ? t('fill.hint.minSelected', { n: minSelected }) : undefined,
    limit ? t('fill.hint.maxSelected', { n: limit }) : undefined,
  ].filter((h): h is string => h !== undefined);

  const description =
    field.help || hints.length > 0 ? (
      <>
        {field.help && (
          <Text span display="block" size="xs">
            {field.help}
          </Text>
        )}
        {hints.map((h) => (
          <Text key={h} span display="block" size="xs">
            {h}
          </Text>
        ))}
      </>
    ) : undefined;
  const handleChange = (next: string[]) => {
    if (limit !== undefined && next.length > limit) return;
    // Store in the snapshot's option order regardless of click order.
    onChange(choices.filter((c) => next.includes(c.id)).map((c) => c.id));
  };

  if (field.options.display === 'chips') {
    return (
      <ChoiceGroup
        role="group"
        label={field.label}
        description={description}
        required={field.required}
        error={error}
      >
        <Chip.Group multiple value={selected} onChange={handleChange}>
          <Group gap="xs" mt="xs">
            {choices.map((c) => (
              <Chip
                key={c.id}
                value={c.id}
                disabled={disabled || (full && !selected.includes(c.id))}
              >
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
      role="group"
      label={field.label}
      description={description}
      required={field.required}
      error={error}
    >
      <Stack gap="xs" mt="xs">
        {choices.map((c) => (
          <Checkbox
            key={c.id}
            value={c.id}
            label={c.label}
            checked={selected.includes(c.id)}
            onChange={(e) =>
              handleChange(
                e.currentTarget.checked
                  ? [...selected, c.id]
                  : selected.filter((id) => id !== c.id),
              )
            }
            disabled={disabled || (full && !selected.includes(c.id))}
          />
        ))}
      </Stack>
    </ChoiceGroup>
  );
}
