import { render, type RenderResult } from '@testing-library/react';
import { vi } from 'vitest';
import { createMemoryRouter } from 'react-router';
import { App } from '../App';
import { de } from '../i18n/de';
import { en } from '../i18n/en';
import type { Language } from '../i18n/detect';
import { routes } from '../router';

/** `path` may be a list (history stack, last one is current) to simulate in-app navigation. */
export function renderApp(
  path: string | string[] = '/forms',
  language: Language = 'de',
): RenderResult {
  // 'auto' resolves from the browser languages; pin them to the rendered language.
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue([language]);
  const router = createMemoryRouter(routes, {
    initialEntries: Array.isArray(path) ? path : [path],
    initialIndex: Array.isArray(path) ? path.length - 1 : 0,
  });
  return render(
    <App router={router} initial={{ language, messages: language === 'de' ? de : en }} />,
  );
}
