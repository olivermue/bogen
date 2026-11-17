import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/db';
import { getSettings, saveSettings } from '../db/settings';
import { renderApp } from '../test/renderApp';
import { mockViewport } from '../test/viewport';

// Library switched on: these tests cover the menu and route as before (hidden case: libraryHidden.test.tsx).
vi.mock('../config/features', () => ({ LIBRARY_ENABLED: true }));

beforeEach(async () => {
  await db.settings.clear();
});

const FORMS_LINK = { name: 'Meine Formulare' };

describe('AppLayout', () => {
  it('still renders the shell with defaults when reading settings fails', async () => {
    mockViewport('desktop');
    vi.spyOn(db.settings, 'get').mockRejectedValue(new Error('idb broken'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderApp();
    expect(await screen.findByRole('link', FORMS_LINK)).toBeInTheDocument();
    expect(log).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('desktop: menu visible, burger hides it and persists the choice', async () => {
    mockViewport('desktop');
    renderApp();
    expect(await screen.findByRole('link', FORMS_LINK)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Menü umschalten' }));
    await waitFor(() => expect(screen.queryByRole('link', FORMS_LINK)).not.toBeInTheDocument());
    await waitFor(async () => expect((await getSettings()).navbarDesktopOpen).toBe(false));
  });

  it('desktop: starts closed when the stored setting says so', async () => {
    mockViewport('desktop');
    await saveSettings({ navbarDesktopOpen: false });
    renderApp();
    await screen.findByRole('button', { name: 'Menü umschalten' });
    expect(screen.queryByRole('link', FORMS_LINK)).not.toBeInTheDocument();
  });

  it('mobile: starts closed, closes after choosing an item, does not persist', async () => {
    mockViewport('mobile');
    renderApp();
    const burger = await screen.findByRole('button', { name: 'Menü umschalten' });
    expect(screen.queryByRole('link', FORMS_LINK)).not.toBeInTheDocument();
    await userEvent.click(burger);
    expect(await screen.findByRole('link', FORMS_LINK)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Einstellungen' }));
    await waitFor(() => expect(screen.queryByRole('link', FORMS_LINK)).not.toBeInTheDocument());
    expect((await getSettings()).navbarDesktopOpen).toBe(true);
  });

  it('offers the five menu items', async () => {
    mockViewport('desktop');
    renderApp();
    for (const name of [
      'Meine Formulare',
      'Bibliothek',
      'Meine Einträge',
      'Einstellungen',
      'Über',
    ]) {
      expect(await screen.findByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('redirects / to /forms and shows the page title in the header', async () => {
    mockViewport('desktop');
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Meine Formulare' })).toBeInTheDocument();
    expect(screen.getByText('BOGEN')).toBeInTheDocument();
  });

  it('follows the colour scheme setting without localStorage', async () => {
    mockViewport('desktop');
    await saveSettings({ colorScheme: 'dark' });
    renderApp();
    await waitFor(() =>
      expect(document.documentElement.getAttribute('data-mantine-color-scheme')).toBe('dark'),
    );
    expect(localStorage.length).toBe(0);
  });

  it('lazy routes render their placeholder', async () => {
    mockViewport('desktop');
    renderApp('/library');
    expect(await screen.findByRole('heading', { name: 'Bibliothek' })).toBeInTheDocument();
  });

  it.each(['desktop', 'mobile'] as const)(
    '%s: burger stays a hamburger (never a cross) and reports its state',
    async (kind) => {
      mockViewport(kind);
      renderApp();
      const burger = await screen.findByRole('button', { name: 'Menü umschalten' });
      const opened = kind === 'desktop';
      expect(burger).toHaveAttribute('aria-expanded', String(opened));
      expect(burger.querySelector('[data-opened]')).toBeNull();
      await userEvent.click(burger);
      await waitFor(() => expect(burger).toHaveAttribute('aria-expanded', String(!opened)));
      expect(burger.querySelector('[data-opened]')).toBeNull();
    },
  );
});
