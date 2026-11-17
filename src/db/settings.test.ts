import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  DEFAULT_SETTINGS,
  getSettings,
  isStoragePersisted,
  requestPersistentStorage,
  saveSettings,
} from './settings';

beforeEach(async () => {
  await db.settings.clear();
});

describe('settings', () => {
  it('returns defaults without stored record', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.navbarDesktopOpen).toBe(true);
  });

  it('saveSettings merges patch onto current settings', async () => {
    await saveSettings({ copyFormat: 'html' });
    await saveSettings({ language: 'en' });
    expect(await getSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      copyFormat: 'html',
      language: 'en',
    });
  });

  it('fills defaults for fields missing in an old stored record', async () => {
    await db.settings.put({ key: 'app', deleteAfterShare: '7d' } as never);
    expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, deleteAfterShare: '7d' });
  });

  it('persistence helpers never throw', async () => {
    expect(typeof (await requestPersistentStorage())).toBe('boolean');
    expect(typeof (await isStoragePersisted())).toBe('boolean');
    const orig = Object.getOwnPropertyDescriptor(navigator, 'storage');
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persist: () => Promise.reject(new Error('x')),
        persisted: () => Promise.reject(new Error('x')),
      },
    });
    expect(await requestPersistentStorage()).toBe(false);
    expect(await isStoragePersisted()).toBe(false);
    if (orig) Object.defineProperty(navigator, 'storage', orig);
    else delete (navigator as unknown as Record<string, unknown>).storage;
  });
});
