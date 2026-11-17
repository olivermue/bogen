import { useLiveQuery } from 'dexie-react-hooks';
import type { LanguageSetting } from '../i18n/detect';
import { db } from './db';

export type DeleteAfterShare = 'never' | 'immediately' | '1d' | '7d' | '30d';
export type CopyFormat = 'text' | 'markdown' | 'html';
export type Settings = {
  deleteAfterShare: DeleteAfterShare;
  language: LanguageSetting;
  copyFormat: CopyFormat;
  colorScheme: 'auto' | 'light' | 'dark';
  navbarDesktopOpen: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  deleteAfterShare: 'never',
  language: 'auto',
  copyFormat: 'text',
  colorScheme: 'auto',
  navbarDesktopOpen: true,
};

/** Stored record merged over defaults, so fields added later still get a value. */
export async function getSettings(): Promise<Settings> {
  const stored = await db.settings.get('app');
  if (!stored) return { ...DEFAULT_SETTINGS };
  const { key: _key, ...rest } = stored;
  void _key;
  return { ...DEFAULT_SETTINGS, ...rest };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = await getSettings();
    await db.settings.put({ ...current, ...patch, key: 'app' });
  });
}

/**
 * Returns `undefined` while the first read is loading, then the current `Settings`.
 * If the read fails, logs and yields defaults so the UI never stays blank.
 */
export function useSettings(): Settings | undefined {
  return useLiveQuery(
    () =>
      getSettings().catch((error: unknown) => {
        console.error('Could not read settings, using defaults', error);
        return { ...DEFAULT_SETTINGS };
      }),
    [],
  );
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function isStoragePersisted(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}
