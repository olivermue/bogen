import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import type { MessageKey } from './de';
import type { Language, Messages } from './detect';

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;
interface I18nValue {
  language: Language;
  t: Translate;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider(props: {
  language: Language;
  messages: Messages;
  children: ReactNode;
}) {
  const { language, messages, children } = props;

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nValue>(
    () => ({
      language,
      t: (key, params) => {
        const text = messages[key];
        if (!params) return text;
        return text.replace(/\{(\w+)\}/g, (match, name: string) =>
          Object.hasOwn(params, name) ? String(params[name]) : match,
        );
      },
    }),
    [language, messages],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT/useLanguage must be used inside <I18nProvider>');
  return ctx;
}

// Hooks live beside the provider so consumers import from one module.
// eslint-disable-next-line react-refresh/only-export-components
export function useT(): Translate {
  return useI18n().t;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage(): Language {
  return useI18n().language;
}
