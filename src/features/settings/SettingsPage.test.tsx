import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/db';
import { getSettings } from '../../db/settings';
import { renderApp } from '../../test/renderApp';
import { mockViewport } from '../../test/viewport';

beforeEach(async () => {
  await db.settings.clear();
  mockViewport('desktop');
});

afterEach(() => {
  delete (navigator as unknown as Record<string, unknown>).storage;
});

function mockStorage(
  persisted: boolean,
  persist: () => Promise<boolean> = () => Promise.resolve(persisted),
) {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: { persisted: () => Promise.resolve(persisted), persist },
  });
}

describe('SettingsPage', () => {
  it('switches the language at runtime and re-renders the menu', async () => {
    renderApp('/settings');
    expect(await screen.findByRole('link', { name: 'Meine Formulare' })).toBeInTheDocument();
    await userEvent.selectOptions(await screen.findByLabelText('Sprache'), 'en');
    expect(await screen.findByRole('link', { name: 'My forms' })).toBeInTheDocument();
    expect((await getSettings()).language).toBe('en');
  });

  it('offers exactly the five delete-after-share values', async () => {
    renderApp('/settings');
    const select = await screen.findByLabelText('Eintrag nach dem Teilen löschen');
    const options = within(select).getAllByRole('option') as HTMLOptionElement[];
    expect(options.map((o) => o.value)).toEqual(['never', 'immediately', '1d', '7d', '30d']);
    expect(options.map((o) => o.textContent)).toEqual([
      'Nie',
      'Sofort',
      'Nach 1 Tag',
      'Nach 7 Tagen',
      'Nach 30 Tagen',
    ]);
    await userEvent.selectOptions(select, '7d');
    await waitFor(async () => expect((await getSettings()).deleteAfterShare).toBe('7d'));
  });

  it('saves copy format and colour scheme', async () => {
    renderApp('/settings');
    await userEvent.selectOptions(await screen.findByLabelText('Format beim Kopieren'), 'markdown');
    await userEvent.selectOptions(screen.getByLabelText('Farbschema'), 'dark');
    await waitFor(async () => {
      const s = await getSettings();
      expect([s.copyFormat, s.colorScheme]).toEqual(['markdown', 'dark']);
    });
  });

  it('shows "nicht dauerhaft" when storage is not persisted', async () => {
    mockStorage(false);
    renderApp('/settings');
    expect(await screen.findByText('nicht dauerhaft')).toBeInTheDocument();
  });

  it('shows "dauerhaft" when storage is persisted', async () => {
    mockStorage(true);
    renderApp('/settings');
    expect(await screen.findByText('dauerhaft')).toBeInTheDocument();
  });

  it('shows the install hint when storage is not persisted', async () => {
    mockStorage(false);
    renderApp('/settings');
    expect(
      await screen.findByText(/Browser darf diese Daten bei Speichermangel/),
    ).toBeInTheDocument();
  });

  it('shows no hint when storage is persisted', async () => {
    mockStorage(true);
    renderApp('/settings');
    await screen.findByText('dauerhaft');
    expect(screen.queryByText(/Speichermangel/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Erneut anfragen' })).not.toBeInTheDocument();
  });

  it('re-requests persistence and refreshes the status on click', async () => {
    let granted = false;
    const persist = vi.fn(() => {
      granted = true;
      return Promise.resolve(true);
    });
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persisted: () => Promise.resolve(granted), persist },
    });
    renderApp('/settings');
    await userEvent.click(await screen.findByRole('button', { name: 'Erneut anfragen' }));
    expect(persist).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('dauerhaft')).toBeInTheDocument();
    expect(screen.queryByText(/Speichermangel/)).not.toBeInTheDocument();
  });

  it('says so when the browser turns the request down', async () => {
    const persist = vi.fn(() => Promise.resolve(false));
    mockStorage(false, persist);
    renderApp('/settings');
    const button = await screen.findByRole('button', { name: 'Erneut anfragen' });
    expect(screen.queryByText(/nicht gewährt/)).not.toBeInTheDocument();
    await userEvent.click(button);
    expect(
      await screen.findByText('Der Browser hat dauerhaften Speicher nicht gewährt.'),
    ).toBeInTheDocument();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('calls persist only once on a double click', async () => {
    const persist = vi.fn(() => new Promise<boolean>((r) => setTimeout(() => r(false), 50)));
    mockStorage(false, persist);
    renderApp('/settings');
    const button = await screen.findByRole('button', { name: 'Erneut anfragen' });
    await userEvent.dblClick(button);
    await waitFor(() => expect(button).toBeEnabled());
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
