import { Skeleton } from '@mantine/core';
import { lazy, Suspense } from 'react';
import type { DateField, TimeField } from '../../../schema/form';
import type { FieldInputProps } from './types';

// @mantine/dates + dayjs live in their own chunk, fetched only when a date/time field renders.
const loadDates = () => import('./dates/DateTimeInputs');
const LazyDate = lazy(async () => ({ default: (await loadDates()).DateFieldInputImpl }));
const LazyTime = lazy(async () => ({ default: (await loadDates()).TimeFieldInputImpl }));

const fallback = <Skeleton height={60} />;

export function DateFieldInput(props: FieldInputProps<DateField>) {
  return (
    <Suspense fallback={fallback}>
      <LazyDate {...props} />
    </Suspense>
  );
}

export function TimeFieldInput(props: FieldInputProps<TimeField>) {
  return (
    <Suspense fallback={fallback}>
      <LazyTime {...props} />
    </Suspense>
  );
}
