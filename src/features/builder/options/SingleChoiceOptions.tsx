import { Stack } from '@mantine/core';
import type { SingleChoiceField } from '../../../schema/form';
import { ChoiceList } from './ChoiceList';
import { SingleDisplaySelect } from './SingleDisplaySelect';

export function SingleChoiceOptions(props: {
  options: SingleChoiceField['options'];
  onChange: (options: SingleChoiceField['options']) => void;
}) {
  const { options, onChange } = props;
  return (
    <Stack gap="sm">
      <ChoiceList
        choices={options.choices}
        onChange={(choices) => onChange({ ...options, choices })}
      />
      <SingleDisplaySelect
        value={options.display}
        onChange={(display) => onChange({ ...options, display })}
      />
    </Stack>
  );
}
