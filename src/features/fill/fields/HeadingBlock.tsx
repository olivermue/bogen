import { Text, Title } from '@mantine/core';
import type { HeadingField } from '../../../schema/form';

export function HeadingBlock({ field }: { field: HeadingField }) {
  const text = field.options.text.trim();
  if (text === '' && !field.help) return null;
  return (
    <div>
      {text !== '' && <Title order={3}>{field.options.text}</Title>}
      {field.help && (
        <Text size="sm" c="dimmed">
          {field.help}
        </Text>
      )}
    </div>
  );
}
