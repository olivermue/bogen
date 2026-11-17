// Lazy chunk: the only place that imports @mantine/dates, its CSS and dayjs (decision D1).
import { DatePickerInput, DatesProvider, TimeInput } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { useEffect, useState } from 'react';
import type { Language } from '../../../../i18n/detect';
import { useLanguage } from '../../../../i18n/I18nProvider';
import type { DateField, TimeField } from '../../../../schema/form';
import { dateBounds, weekdayOf } from '../dateRules';
import type { FieldInputProps } from '../types';

// dayjs ships 'en' built in; other locales are loaded on demand (own chunk).
const localeLoaders: Partial<Record<Language, () => Promise<unknown>>> = {
  de: () => import('dayjs/locale/de'),
};
const loadedLocales = new Set<Language>(['en']);

/** Registers the dayjs locale for `lang`; returns the locale Mantine may use right now. */
function useDayjsLocale(lang: Language): Language {
  const [, setTick] = useState(0);
  const ready = loadedLocales.has(lang);
  useEffect(() => {
    if (ready) return;
    let active = true;
    const load = localeLoaders[lang];
    if (!load) return;
    load().then(
      () => {
        loadedLocales.add(lang);
        if (active) setTick((n) => n + 1);
      },
      (error: unknown) => console.error(`Could not load dayjs locale "${lang}"`, error),
    );
    return () => {
      active = false;
    };
  }, [lang, ready]);
  return ready ? lang : 'en';
}

const VALUE_FORMAT: Record<Language, string> = { de: 'DD.MM.YYYY', en: 'MM/DD/YYYY' };

export function DateFieldInputImpl({
  field,
  value,
  onChange,
  error,
  disabled,
}: FieldInputProps<DateField>) {
  const lang = useLanguage();
  const locale = useDayjsLocale(lang);
  const { min, max } = dateBounds(field);
  const disabledWeekdays = field.options.disabledWeekdays ?? [];
  return (
    <DatesProvider settings={{ locale, firstDayOfWeek: lang === 'de' ? 1 : 0 }}>
      <DatePickerInput
        label={field.label}
        description={field.help}
        withAsterisk={field.required}
        valueFormat={VALUE_FORMAT[lang]}
        clearable
        minDate={min}
        maxDate={max}
        excludeDate={
          disabledWeekdays.length > 0
            ? (date) => disabledWeekdays.includes(weekdayOf(date.slice(0, 10)))
            : undefined
        }
        value={typeof value === 'string' && value !== '' ? value : null}
        // Mantine 8+ returns local 'YYYY-MM-DD' strings; never converted via toISOString().
        onChange={(v) => onChange(v ? v.slice(0, 10) : null)}
        error={error}
        disabled={disabled}
      />
    </DatesProvider>
  );
}

export function TimeFieldInputImpl({
  field,
  value,
  onChange,
  error,
  disabled,
}: FieldInputProps<TimeField>) {
  const { min, max, stepMinutes } = field.options;
  return (
    <TimeInput
      label={field.label}
      description={field.help}
      withAsterisk={field.required}
      minTime={min}
      maxTime={max}
      min={min}
      max={max}
      step={stepMinutes ? stepMinutes * 60 : undefined}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => {
        const v = e.currentTarget.value;
        onChange(v === '' ? null : v.slice(0, 5));
      }}
      error={error}
      disabled={disabled}
    />
  );
}
