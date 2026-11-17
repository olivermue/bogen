import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COPYRIGHT_HOLDER } from '../../config/legal';
import { connectUpdater, resetUpdateState, setUpdateWaiting } from '../../pwa/updateState';
import { renderApp } from '../../test/renderApp';
import { mockViewport } from '../../test/viewport';

afterEach(() => {
  act(() => resetUpdateState());
});

describe('AboutPage', () => {
  it('shows subtitle, version and copyright notice', async () => {
    mockViewport('desktop');
    renderApp('/about');
    expect(await screen.findByText(/aukasten für .*ffline-Formulare/)).toBeInTheDocument();
    expect(screen.getByText(/^Version \d/)).toBeInTheDocument();
    expect(screen.getByText(/Alle Rechte vorbehalten/)).toBeInTheDocument();
    expect(screen.getByText(COPYRIGHT_HOLDER, { exact: false })).toBeInTheDocument();
  });

  it('highlights the acronym letters B-O-G-E-N without visible markers', async () => {
    mockViewport('desktop');
    const { container } = renderApp('/about');
    await screen.findByText(/^Version \d/);
    const letters = [...container.querySelectorAll('[data-acronym]')].map((el) => el.textContent);
    expect(letters).toEqual(['B', 'O', 'G', 'E', 'N']);
    expect(container.textContent).toContain(
      'Baukasten für Offline-Formulare: Gestalten, Eintragen, Nachrichten teilen',
    );
    // The theme injects a <style> element whose CSS contains brackets: look at visible text only.
    const visible = [...container.querySelectorAll('body *:not(style)')]
      .flatMap((el) => [...el.childNodes])
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join('');
    expect(visible).not.toMatch(/[[\]]/);
  });

  it('shows the plain English subtitle without highlighting', async () => {
    mockViewport('desktop');
    const { container } = renderApp('/about', 'en');
    expect(await screen.findByText('Build, fill and share forms – offline')).toBeInTheDocument();
    expect(container.querySelector('[data-acronym]')).toBeNull();
  });

  it('shows the build version and short git SHA', async () => {
    mockViewport('desktop');
    renderApp('/about');
    expect(
      await screen.findByText(/^Version \d+\.\d+\.\d+\S* \((?:[0-9a-f]{7,12}|dev)\)$/),
    ).toBeInTheDocument();
    expect(screen.getByText(`Version ${__APP_VERSION__} (${__GIT_SHA__})`)).toBeInTheDocument();
  });

  it('checks for updates on request', async () => {
    mockViewport('desktop');
    const update = vi.fn(() => Promise.resolve());
    connectUpdater({
      registration: {
        installing: null,
        waiting: null,
        update,
      } as unknown as ServiceWorkerRegistration,
    });
    renderApp('/about');
    await userEvent.click(await screen.findByRole('button', { name: 'Nach Updates suchen' }));
    expect(update).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('BOGEN ist auf dem neuesten Stand.')).toBeInTheDocument();
  });

  it('offers "update now" while a new version is waiting', async () => {
    mockViewport('desktop');
    const updateServiceWorker = vi.fn(() => Promise.resolve());
    renderApp('/about');
    await screen.findByText(/^Version \d/);
    connectUpdater({ updateServiceWorker }); // after UpdatePrompt connected the default mock
    act(() => setUpdateWaiting(true));
    await userEvent.click(await screen.findByRole('button', { name: 'Jetzt aktualisieren' }));
    await vi.waitFor(() => expect(updateServiceWorker).toHaveBeenCalledWith(true));
  });
});
