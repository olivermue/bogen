import type { DateBound } from '../schema/form';
import type { Language } from '../i18n/detect';

// All helpers work in LOCAL time and format by hand: no toISOString (UTC),
// no `new Date('YYYY-MM-DD')` (parsed as UTC), no ICU (U+202F before AM/PM).

const pad = (n: number): string => String(n).padStart(2, '0');

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today as local `YYYY-MM-DD`. */
export function todayLocal(now: Date = new Date()): string {
  return toIso(now);
}

/** Fixed bound as-is; relative bound = local today + `days`. */
export function resolveBound(b: DateBound, now: Date = new Date()): string {
  if (b.kind === 'fixed') return b.date;
  return toIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + b.days));
}

/** de `16.11.2026` / `01.11.2026`, en `11/16/2026` / `11/1/2026`. Malformed input is returned unchanged. */
export function formatDate(iso: string, lang: Language): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  // en-US style without leading zeros (11/1/2026); de keeps them (01.11.2026).
  return lang === 'de' ? `${d}.${mo}.${y}` : `${Number(mo)}/${Number(d)}/${y}`;
}

/** de `14:30`, en `2:30 PM`. Malformed input is returned unchanged. */
export function formatTime(hhmm: string, lang: Language): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  if (lang === 'de') return hhmm;
  const h = Number(m[1]);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}
