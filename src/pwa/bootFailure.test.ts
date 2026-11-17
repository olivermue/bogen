import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderBootFailure } from './bootFailure';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('renderBootFailure', () => {
  it('shows bilingual text and a reset button (sole i18n exception)', () => {
    const root = document.createElement('div');
    const reset = vi.fn(() => Promise.resolve());
    renderBootFailure(root, reset);
    expect(root.textContent).toContain('Start fehlgeschlagen');
    expect(root.textContent).toContain('could not start');
    const button = root.querySelector('button');
    expect(button?.textContent).toBe('App zurücksetzen / Reset app');
    button?.click();
    expect(reset).toHaveBeenCalledTimes(1);
    expect(button?.disabled).toBe(true);
  });

  it('disables the reset offline with a bilingual hint, enables it when back online', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const root = document.createElement('div');
    const reset = vi.fn(() => Promise.resolve());
    renderBootFailure(root, reset);
    const button = root.querySelector('button')!;
    const hint = [...root.querySelectorAll('p')].find((p) =>
      p.textContent?.includes('Internetverbindung'),
    )!;
    expect(button.disabled).toBe(true);
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toContain('Resetting needs an internet connection');
    button.click();
    expect(reset).not.toHaveBeenCalled();

    onLine.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    expect(button.disabled).toBe(false);
    expect(hint.hidden).toBe(true);
    button.click();
    expect(reset).toHaveBeenCalledTimes(1);
    // Stays disabled while resetting, even on further online/offline switches.
    window.dispatchEvent(new Event('online'));
    expect(button.disabled).toBe(true);
  });
});
