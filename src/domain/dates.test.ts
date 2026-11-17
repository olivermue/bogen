import { describe, expect, it } from 'vitest';
import { formatDate, formatTime, resolveBound, todayLocal } from './dates';

describe('todayLocal', () => {
  it('uses local date near midnight', () => {
    expect(todayLocal(new Date(2026, 10, 1, 0, 30))).toBe('2026-11-01');
    expect(todayLocal(new Date(2026, 10, 1, 23, 59))).toBe('2026-11-01');
  });
});

describe('resolveBound', () => {
  it('resolves relative bound across a month boundary', () => {
    expect(resolveBound({ kind: 'relative', days: 7 }, new Date(2026, 10, 28))).toBe('2026-12-05');
  });
  it('supports negative offsets and zero', () => {
    expect(resolveBound({ kind: 'relative', days: -1 }, new Date(2026, 10, 1, 0, 5))).toBe(
      '2026-10-31',
    );
    expect(resolveBound({ kind: 'relative', days: 0 }, new Date(2026, 10, 1, 0, 5))).toBe(
      '2026-11-01',
    );
  });
  it('returns fixed bounds unchanged', () => {
    expect(resolveBound({ kind: 'fixed', date: '2026-01-02' }, new Date(2026, 10, 1))).toBe(
      '2026-01-02',
    );
  });
});

describe('formatDate', () => {
  it('formats de and en', () => {
    expect(formatDate('2026-11-16', 'de')).toBe('16.11.2026');
    expect(formatDate('2026-11-16', 'en')).toBe('11/16/2026');
  });
  it('keeps the first of a month (no day shift)', () => {
    expect(formatDate('2026-11-01', 'de')).toBe('01.11.2026');
    expect(formatDate('2026-11-01', 'en')).toBe('11/1/2026');
    expect(formatDate('2026-03-05', 'en')).toBe('3/5/2026');
  });
  it('returns malformed input unchanged', () => {
    expect(formatDate('nope', 'de')).toBe('nope');
  });
});

describe('formatTime', () => {
  it('formats de as 24h and en as 12h with a plain space', () => {
    expect(formatTime('14:30', 'de')).toBe('14:30');
    expect(formatTime('14:30', 'en')).toBe('2:30 PM');
    expect(formatTime('00:05', 'en')).toBe('12:05 AM');
    expect(formatTime('12:00', 'en')).toBe('12:00 PM');
    expect(formatTime('09:07', 'de')).toBe('09:07');
  });
  it('returns malformed input unchanged', () => {
    expect(formatTime('x', 'en')).toBe('x');
  });
});
