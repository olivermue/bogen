import { ActionIcon, Card, Group, Stack, Switch, Text, TextInput, Textarea } from '@mantine/core';
import type { ReactNode } from 'react';
import type { MessageKey } from '../../i18n/de';
import { useT } from '../../i18n/I18nProvider';
import type { Field } from '../../schema/form';
import { DateOptions } from './options/DateOptions';
import { HeadingOptions } from './options/HeadingOptions';
import { MultipleChoiceOptions } from './options/MultipleChoiceOptions';
import { NumberOptions } from './options/NumberOptions';
import { SingleChoiceOptions } from './options/SingleChoiceOptions';
import { TextAreaOptions } from './options/TextAreaOptions';
import { TextLineOptions } from './options/TextLineOptions';
import { TimeOptions } from './options/TimeOptions';
import { YesNoOptions } from './options/YesNoOptions';
import { toOptionalText } from './options/util';

function FieldOptions(props: { field: Field; onChange: (field: Field) => void }) {
  const { field, onChange } = props;
  switch (field.type) {
    case 'textLine':
      return (
        <TextLineOptions
          options={field.options}
          onChange={(options) => onChange({ ...field, options })}
        />
      );
    case 'textArea':
      return (
        <TextAreaOptions
          options={field.options}
          onChange={(options) => onChange({ ...field, options })}
        />
      );
    case 'singleChoice':
      return (
        <SingleChoiceOptions
          options={field.options}
          onChange={(options) => onChange({ ...field, options })}
        />
      );
    case 'multipleChoice':
      return (
        <MultipleChoiceOptions
          options={field.options}
          onChange={(options) => onChange({ ...field, options })}
        />
      );
    case 'date':
      return (
        <DateOptions
          options={field.options}
          onChange={(options) => onChange({ ...field, options })}
        />
      );
    case 'time':
      return (
        <TimeOptions
          options={field.options}
          onChange={(options) => onChange({ ...field, options })}
        />
      );
    case 'number':
      return (
        <NumberOptions
          options={field.options}
          onChange={(options) => onChange({ ...field, options })}
        />
      );
    case 'yesNo':
      return (
        <YesNoOptions
          options={field.options}
          onChange={(options) => onChange({ ...field, options })}
        />
      );
    case 'heading':
      return (
        <HeadingOptions
          options={field.options}
          onChange={(options) => onChange({ ...field, options })}
        />
      );
  }
}

/** One builder card: header with actions, collapsible editor body. */
export function FieldEditor(props: {
  field: Field;
  index: number;
  count: number;
  expanded: boolean;
  errors: string[];
  /** Drag handle supplied by the sortable wrapper; gets the accessible name of this card. */
  handle: (name: string) => ReactNode;
  onToggle: () => void;
  onChange: (field: Field) => void;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const { field, index, count, expanded, errors } = props;
  const summary =
    field.label?.trim() ||
    (field.type === 'heading' ? field.options.text.trim() : '') ||
    t('builder.field.untitled');
  const type = t(`builder.fieldType.${field.type}` as MessageKey);
  // Accessible names carry position and label: "Baustein 2 „Name“ nach unten".
  const name = t('builder.field.name', { n: index + 1, label: summary });
  // Visible header text; the header button's accessible name starts with it (WCAG 2.5.3).
  const title = `${index + 1}. ${type}: ${summary}`;

  return (
    <Card withBorder padding="sm" className="bogen-list-card" data-testid={`field-${index}`}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          {props.handle(name)}
          <Text
            fw={500}
            truncate
            component="button"
            type="button"
            aria-expanded={expanded}
            aria-label={t(expanded ? 'builder.field.collapse' : 'builder.field.expand', {
              title,
            })}
            onClick={props.onToggle}
            style={{
              background: 'none',
              border: 0,
              padding: 0,
              cursor: 'pointer',
              color: 'inherit',
            }}
          >
            {title}
          </Text>
        </Group>
        <Group gap={4} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            aria-label={t('builder.field.moveUp', { name })}
            disabled={index === 0}
            onClick={() => props.onMove(index - 1)}
          >
            ↑
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            aria-label={t('builder.field.moveDown', { name })}
            disabled={index === count - 1}
            onClick={() => props.onMove(index + 1)}
          >
            ↓
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            aria-label={t('builder.field.duplicate', { name })}
            onClick={props.onDuplicate}
          >
            ⧉
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            aria-label={t('builder.field.delete', { name })}
            onClick={props.onDelete}
          >
            🗑
          </ActionIcon>
        </Group>
      </Group>

      {errors.map((message) => (
        <Text key={message} c="red" size="sm" mt="xs" role="alert">
          {message}
        </Text>
      ))}

      {expanded && (
        <Stack gap="sm" mt="sm">
          <TextInput
            label={t('builder.field.label')}
            value={field.label ?? ''}
            onChange={(e) =>
              props.onChange({ ...field, label: toOptionalText(e.currentTarget.value) })
            }
          />
          <Textarea
            label={t('builder.field.help')}
            autosize
            minRows={1}
            value={field.help ?? ''}
            onChange={(e) =>
              props.onChange({ ...field, help: toOptionalText(e.currentTarget.value) })
            }
          />
          {field.type !== 'heading' && (
            <Switch
              label={t('builder.field.required')}
              checked={field.required}
              onChange={(e) => props.onChange({ ...field, required: e.currentTarget.checked })}
            />
          )}
          <FieldOptions field={field} onChange={props.onChange} />
        </Stack>
      )}
    </Card>
  );
}
