import { DEFAULT_THEME, mergeMantineTheme } from '@mantine/core';
import { describe, expect, it } from 'vitest';
import { cssVariablesResolver, DARK_PRIMARY_FILLED, theme } from './theme';

// MantineProvider calls the resolver with the full theme (defaults merged in).
const fullTheme = mergeMantineTheme(DEFAULT_THEME, theme);

/** WCAG 2 contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, b2] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b2!;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('theme', () => {
  it('uses the mockup petrol #127a9e for filled primary buttons in the dark scheme', () => {
    const vars = cssVariablesResolver(fullTheme);
    expect(DARK_PRIMARY_FILLED).toBe('#127a9e');
    expect(vars.dark['--mantine-color-petrol-filled']).toBe('#127a9e');
  });

  it('keeps white button text at >= 4.5:1 on the filled primary (and its hover)', () => {
    const vars = cssVariablesResolver(fullTheme);
    const filled = vars.dark['--mantine-color-petrol-filled']!;
    const hover = vars.dark['--mantine-color-petrol-filled-hover']!;
    expect(contrast('#ffffff', filled)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', filled)).toBeCloseTo(4.88, 1);
    expect(contrast('#ffffff', hover)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', theme.colors!.petrol![6])).toBeGreaterThanOrEqual(4.5);
  });
});
