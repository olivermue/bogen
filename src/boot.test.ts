import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { de } from './i18n/de';
import { en } from './i18n/en';

const loadMessages = vi.fn();
const getSettings = vi.fn();
vi.mock('./i18n/detect', async (orig) => ({
  ...(await orig<typeof import('./i18n/detect')>()),
  loadMessages: (l: string) => loadMessages(l),
}));
vi.mock('./db/settings', async (orig) => ({
  ...(await orig<typeof import('./db/settings')>()),
  getSettings: () => getSettings(),
}));

import { DEFAULT_SETTINGS } from './db/settings';
import { resolveBoot } from './boot';

beforeEach(() => {
  loadMessages.mockReset();
  getSettings.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks(); // console spy
});

describe('resolveBoot', () => {
  it('uses stored language', async () => {
    getSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, language: 'en' });
    loadMessages.mockResolvedValue(en);
    expect(await resolveBoot(['de'])).toEqual({
      language: 'en',
      messages: en,
      colorScheme: 'auto',
    });
  });

  it('passes the stored colour scheme on (initial value, no flash)', async () => {
    getSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, colorScheme: 'dark' });
    loadMessages.mockResolvedValue(de);
    expect(await resolveBoot(['de'])).toMatchObject({ language: 'de', colorScheme: 'dark' });
  });

  it('falls back to defaults when settings fail to load', async () => {
    getSettings.mockRejectedValue(new Error('idb'));
    loadMessages.mockResolvedValue(de);
    expect(await resolveBoot(['de'])).toEqual({
      language: 'de',
      messages: de,
      colorScheme: 'auto',
    });
    expect(console.error).toHaveBeenCalled();
  });

  it('falls back to the other language when messages fail', async () => {
    getSettings.mockResolvedValue({ ...DEFAULT_SETTINGS });
    loadMessages.mockImplementation((l: string) =>
      l === 'de' ? Promise.reject(new Error('chunk')) : Promise.resolve(en),
    );
    expect(await resolveBoot(['de'])).toEqual({
      language: 'en',
      messages: en,
      colorScheme: 'auto',
    });
  });

  it('returns null when no dictionary loads', async () => {
    getSettings.mockResolvedValue({ ...DEFAULT_SETTINGS });
    loadMessages.mockRejectedValue(new Error('chunk'));
    expect(await resolveBoot(['de'])).toBeNull();
  });
});
