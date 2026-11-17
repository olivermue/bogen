import { ActionIcon, Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { useT } from '../../../i18n/I18nProvider';
import type { ChoiceOption } from '../../../schema/form';
import { newChoice } from '../newField';

/** Add / remove / rename options; shared by single and multiple choice. */
export function ChoiceList(props: {
  choices: ChoiceOption[];
  onChange: (choices: ChoiceOption[]) => void;
}) {
  const t = useT();
  const { choices, onChange } = props;
  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        {t('builder.opt.choices')}
      </Text>
      {choices.map((choice, i) => (
        <Group key={choice.id} gap="xs" wrap="nowrap">
          <TextInput
            style={{ flex: 1 }}
            aria-label={t('builder.opt.choice', { n: i + 1 })}
            value={choice.label}
            onChange={(e) => {
              const label = e.currentTarget.value;
              onChange(choices.map((c, j) => (j === i ? { ...c, label } : c)));
            }}
          />
          <ActionIcon
            variant="subtle"
            color="red"
            aria-label={t('builder.opt.choiceRemove', { n: i + 1 })}
            onClick={() => onChange(choices.filter((_, j) => j !== i))}
          >
            ✕
          </ActionIcon>
        </Group>
      ))}
      <Button
        variant="light"
        size="xs"
        style={{ alignSelf: 'flex-start' }}
        onClick={() =>
          onChange([
            ...choices,
            newChoice(t('builder.opt.choiceDefault', { n: choices.length + 1 })),
          ])
        }
      >
        {t('builder.opt.choiceAdd')}
      </Button>
    </Stack>
  );
}
