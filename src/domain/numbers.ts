import type { Language } from '../i18n/detect';

/** Decimal separator of the UI language: de `,`, en `.`. */
export function decimalSeparator(lang: Language): ',' | '.' {
  return lang === 'de' ? ',' : '.';
}

/**
 * Number for output: no thousands grouping, floating-point noise removed (at most 15 significant
 * digits, so 0.1 + 0.2 gives "0,3" / "0.3" while tiny values like 1e-12 stay exact), decimal
 * separator of the language. -0 is shown as "0".
 */
export function formatNumber(value: number, lang: Language): string {
  return new Intl.NumberFormat(lang, { useGrouping: false, maximumSignificantDigits: 15 }).format(
    value === 0 ? 0 : value,
  );
}

/** Number from a (possibly partial) NumberInput value; undefined while not a finite number. */
export function parseNumberDraft(value: number | string): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
