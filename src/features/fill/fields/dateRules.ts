import { resolveBound } from '../../../domain/dates';
import type { DateField } from '../../../schema/form';

/** Local weekday (0 = Sunday) of a `YYYY-MM-DD` string; parsed by hand, never as UTC. */
export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getDay();
}

/** Resolved `min`/`max` of a date field as local `YYYY-MM-DD` (relative bounds from `now`). */
export function dateBounds(
  field: DateField,
  now: Date = new Date(),
): { min?: string; max?: string } {
  const { min, max } = field.options;
  return {
    min: min ? resolveBound(min, now) : undefined,
    max: max ? resolveBound(max, now) : undefined,
  };
}

/** Whether `iso` is selectable: inside min/max and not on a disabled weekday. */
export function isDateAllowed(field: DateField, iso: string, now: Date = new Date()): boolean {
  const { min, max } = dateBounds(field, now);
  if (min !== undefined && iso < min) return false;
  if (max !== undefined && iso > max) return false;
  return !(field.options.disabledWeekdays ?? []).includes(weekdayOf(iso));
}
