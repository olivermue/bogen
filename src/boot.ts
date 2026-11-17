import { DEFAULT_SETTINGS, getSettings, type Settings } from './db/settings';
import { loadMessages, resolveLanguage, type Language, type Messages } from './i18n/detect';

export interface BootState {
  language: Language;
  messages: Messages;
  /** Stored colour scheme, the initial value for Mantine (no flash after the first paint). */
  colorScheme?: Settings['colorScheme'];
}

/**
 * Settings -> language -> messages, never throwing: a failed settings read falls
 * back to defaults, a failed dictionary load to the other language. `null` only
 * if no dictionary can be loaded at all.
 */
export async function resolveBoot(languages: readonly string[]): Promise<BootState | null> {
  let settings: Settings = { ...DEFAULT_SETTINGS };
  try {
    settings = await getSettings();
  } catch (error) {
    console.error('Could not load settings, using defaults', error);
  }
  const preferred = resolveLanguage(settings.language, languages);
  const candidates: Language[] = preferred === 'de' ? ['de', 'en'] : ['en', 'de'];
  for (const language of candidates) {
    try {
      return {
        language,
        messages: await loadMessages(language),
        colorScheme: settings.colorScheme,
      };
    } catch (error) {
      console.error(`Could not load "${language}" messages`, error);
    }
  }
  return null;
}
