import type { MessageKey } from './de';

export type Language = 'de' | 'en';
export type LanguageSetting = 'auto' | Language;
export type Messages = Record<MessageKey, string>;

// First de-/en- language tag wins; anything else falls back to English.
export function detectLanguage(languages: readonly string[]): Language {
  for (const tag of languages) {
    const primary = tag.toLowerCase().split('-')[0];
    if (primary === 'de' || primary === 'en') return primary;
  }
  return 'en';
}

export function resolveLanguage(setting: LanguageSetting, languages: readonly string[]): Language {
  return setting === 'auto' ? detectLanguage(languages) : setting;
}

/** Dynamic import keeps each dictionary in its own chunk. */
export async function loadMessages(lang: Language): Promise<Messages> {
  return lang === 'de' ? (await import('./de')).de : (await import('./en')).en;
}
