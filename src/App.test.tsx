import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { App } from './App';
import { db } from './db/db';
import { saveSettings } from './db/settings';
import { de } from './i18n/de';
import { routes } from './router';
import { renderApp } from './test/renderApp';

beforeEach(async () => {
  await db.settings.clear();
});

describe('App', () => {
  it('renders the shell with the app name', async () => {
    renderApp();
    expect(await screen.findByText('BOGEN')).toBeInTheDocument();
  });

  it('applies the colour scheme read at boot with the first render (no flash)', async () => {
    await saveSettings({ colorScheme: 'dark' });
    const router = createMemoryRouter(routes, { initialEntries: ['/forms'] });
    render(<App router={router} initial={{ language: 'de', messages: de, colorScheme: 'dark' }} />);
    // Synchronously after the first render, before the settings query has answered.
    expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'dark');
    await screen.findByText('BOGEN');
    expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'dark');
    // Dark filled primary from the mockup (theme.ts cssVariablesResolver).
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n');
    expect(css).toMatch(/--mantine-color-petrol-filled:\s*#127a9e/);
  });

  it('sets the document title per route and follows a language change', async () => {
    renderApp('/settings');
    await waitFor(() => expect(document.title).toBe('Einstellungen – BOGEN'));
    await saveSettings({ language: 'en' });
    await waitFor(() => expect(document.title).toBe('Settings – BOGEN'));
  });
});
