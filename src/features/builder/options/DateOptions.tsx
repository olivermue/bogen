import { Checkbox, NativeSelect, Stack, Switch, TextInput } from '@mantine/core';
import { useLanguage, useT } from '../../../i18n/I18nProvider';
import { DraftNumberInput } from './DraftNumberInput';
import type { DateBound, DateField } from '../../../schema/form';

type BoundKind = 'none' | 'fixed' | 'relative';

function BoundEditor(props: {
  label: string;
  value: DateBound | undefined;
  onChange: (value: DateBound | undefined) => void;
}) {
  const t = useT();
  const { label, value, onChange } = props;
  const kind: BoundKind = value?.kind ?? 'none';
  const select = (next: string) => {
    if (next === 'fixed') onChange({ kind: 'fixed', date: '' });
    else if (next === 'relative') onChange({ kind: 'relative', days: 0 });
    else onChange(undefined);
  };
  return (
    <Stack gap="xs">
      <NativeSelect
        label={label}
        value={kind}
        data={[
          { value: 'none', label: t('builder.opt.bound.none') },
          { value: 'fixed', label: t('builder.opt.bound.fixed') },
          { value: 'relative', label: t('builder.opt.bound.relative') },
        ]}
        onChange={(e) => select(e.currentTarget.value)}
      />
      {value?.kind === 'fixed' && (
        <TextInput
          type="date"
          label={t('builder.opt.bound.fixedDate', { label })}
          value={value.date}
          onChange={(e) => onChange({ kind: 'fixed', date: e.currentTarget.value })}
        />
      )}
      {value?.kind === 'relative' && (
        <DraftNumberInput
          label={t('builder.opt.bound.days', { label })}
          allowDecimal={false}
          allowEmpty={false}
          value={value.days}
          onCommit={(days) => onChange({ kind: 'relative', days: days ?? 0 })}
        />
      )}
    </Stack>
  );
}

export function DateOptions(props: {
  options: DateField['options'];
  onChange: (options: DateField['options']) => void;
}) {
  const t = useT();
  const language = useLanguage();
  const { options, onChange } = props;
  // 2024-01-07 is a Sunday: day index 0 = Sunday ... 6 = Saturday.
  const weekday = new Intl.DateTimeFormat(language, { weekday: 'long' });
  const disabled = (options.disabledWeekdays ?? []).map(String);
  return (
    <Stack gap="sm">
      <BoundEditor
        label={t('builder.opt.dateMin')}
        value={options.min}
        onChange={(min) => onChange({ ...options, min })}
      />
      <BoundEditor
        label={t('builder.opt.dateMax')}
        value={options.max}
        onChange={(max) => onChange({ ...options, max })}
      />
      <Checkbox.Group
        label={t('builder.opt.disabledWeekdays')}
        value={disabled}
        onChange={(values) => {
          const days = values.map(Number).sort((a, b) => a - b);
          onChange({ ...options, disabledWeekdays: days.length > 0 ? days : undefined });
        }}
      >
        <Stack gap={4} mt={4}>
          {[1, 2, 3, 4, 5, 6, 0].map((day) => (
            <Checkbox
              key={day}
              value={String(day)}
              label={weekday.format(new Date(2024, 0, 7 + day))}
            />
          ))}
        </Stack>
      </Checkbox.Group>
      <Switch
        label={t('builder.opt.defaultToday')}
        checked={options.defaultToday ?? false}
        onChange={(e) => onChange({ ...options, defaultToday: e.currentTarget.checked })}
      />
    </Stack>
  );
}
