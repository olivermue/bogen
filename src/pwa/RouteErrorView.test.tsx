import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render';
import { RouteErrorView } from './RouteErrorView';

const recovery = vi.hoisted(() => ({
  recoverFromChunkError: vi.fn<() => boolean>(),
  resetApp: vi.fn<() => Promise<void>>(),
  reloadPage: vi.fn<() => void>(),
}));

vi.mock('./chunkErrorRecovery', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./chunkErrorRecovery')>()),
  recoverFromChunkError: recovery.recoverFromChunkError,
  resetApp: recovery.resetApp,
  reloadPage: recovery.reloadPage,
}));

function renderFailingRoute(error: unknown, language: 'de' | 'en' = 'de') {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        errorElement: <RouteErrorView />,
        lazy: () => Promise.reject(error),
      },
    ],
    { initialEntries: ['/'] },
  );
  return renderWithProviders(<RouterProvider router={router} />, { language });
}

const chunkError = () => new TypeError('Failed to fetch dynamically imported module: /assets/x.js');

afterEach(() => {
  recovery.recoverFromChunkError.mockReset();
  recovery.resetApp.mockReset().mockResolvedValue(undefined);
  recovery.reloadPage.mockReset();
  vi.restoreAllMocks(); // console spies
});

describe('RouteErrorView', () => {
  it('reloads once automatically on a chunk load error, without showing the error', async () => {
    recovery.recoverFromChunkError.mockReturnValue(true);
    renderFailingRoute(chunkError());
    await vi.waitFor(() => expect(recovery.recoverFromChunkError).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'App zurücksetzen' })).not.toBeInTheDocument();
  });

  it('shows the error view with reset when the reload did not help', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    recovery.recoverFromChunkError.mockReturnValue(false);
    renderFailingRoute(chunkError());
    expect(
      await screen.findByText('Teile der App konnten nicht geladen werden'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Formulare und Einträge bleiben erhalten/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Neu laden' }));
    expect(recovery.reloadPage).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'App zurücksetzen' }));
    expect(recovery.resetApp).toHaveBeenCalledTimes(1);
  });

  it('shows a general error view (English) for other errors, without automatic reload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderFailingRoute(new Error('boom'), 'en');
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset app' })).toBeInTheDocument();
    expect(recovery.recoverFromChunkError).not.toHaveBeenCalled();
  });

  it('disables "Reset app" offline with a hint and enables it again online', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderFailingRoute(new Error('boom'));
    const reset = await screen.findByRole('button', { name: 'App zurücksetzen' });
    expect(reset).toBeDisabled();
    expect(
      screen.getByText(/Zum Zurücksetzen wird eine Internetverbindung benötigt/),
    ).toBeInTheDocument();
    onLine.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(reset).toBeEnabled();
    expect(screen.queryByText(/Internetverbindung benötigt/)).not.toBeInTheDocument();
  });
});
