import { useEffect, useMemo, useState } from 'react';
import type { createHashRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { AppProviders } from './AppProviders';
import type { BootState } from './boot';
import { useSettings } from './db/settings';
import { useCleanupOnActive } from './features/entries/useCleanupOnActive';
import { loadMessages, resolveLanguage } from './i18n/detect';
import { createAppRouter } from './router';
import { UpdatePrompt } from './pwa/UpdatePrompt';

/**
 * Owns the language state: observes the settings and, when the resolved language
 * changes, loads the other dictionary (dynamic import) without a page reload.
 */
export function App(props: {
  initial: BootState;
  /** Injectable for tests (memory router); defaults to the hash router. */
  router?: ReturnType<typeof createHashRouter>;
}) {
  useCleanupOnActive();
  const settings = useSettings();
  const [i18n, setI18n] = useState<BootState>(props.initial);
  const router = useMemo(() => props.router ?? createAppRouter(), [props.router]);

  const setting = settings?.language;
  useEffect(() => {
    if (!setting) return;
    const language = resolveLanguage(setting, navigator.languages);
    if (language === i18n.language) return;
    let active = true;
    loadMessages(language).then(
      (messages) => {
        if (active) setI18n({ language, messages });
      },
      (error: unknown) => console.error(`Could not load "${language}" messages`, error),
    );
    return () => {
      active = false;
    };
  }, [setting, i18n.language]);

  return (
    <AppProviders
      language={i18n.language}
      messages={i18n.messages}
      colorScheme={props.initial.colorScheme}
    >
      <UpdatePrompt />
      <RouterProvider router={router} />
    </AppProviders>
  );
}
