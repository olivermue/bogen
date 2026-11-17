import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AppProviders } from '../AppProviders';
import { de } from '../i18n/de';
import { en } from '../i18n/en';
import type { Language, Messages } from '../i18n/detect';

export function renderWithProviders(
  ui: ReactElement,
  options: { language?: Language; messages?: Messages } = {},
): RenderResult {
  const language = options.language ?? 'de';
  const messages = options.messages ?? (language === 'de' ? de : en);
  return render(
    <AppProviders language={language} messages={messages}>
      {ui}
    </AppProviders>,
  );
}
