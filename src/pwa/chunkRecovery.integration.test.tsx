import { act, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render';
import { installChunkErrorRecovery, resetChunkRecovery } from './chunkErrorRecovery';
import { RouteErrorView } from './RouteErrorView';

/** Like Vite 8's preload helper in the build: `import().catch(handler)`, handler dispatches the event. */
function vitePreload<T>(load: () => Promise<T>): Promise<T> {
  return load().catch((error: unknown) => {
    const event = new Event('vite:preloadError', { cancelable: true }) as Event & {
      payload?: unknown;
    };
    event.payload = error;
    window.dispatchEvent(event);
    if (!event.defaultPrevented) throw error;
    return undefined as T; // what Vite resolves to after preventDefault
  });
}

afterEach(() => {
  resetChunkRecovery();
  window.history.replaceState(null, '');
  vi.restoreAllMocks();
});

describe('chunk error recovery (integration)', () => {
  it('a failing lazy route reloads exactly once and never shows an error view', async () => {
    const error = vi.spyOn(console, 'error');
    const reload = vi.fn();
    const uninstall = installChunkErrorRecovery(window, {
      reload,
      prepare: () => Promise.resolve(),
      now: () => 1_000,
    });
    const router = createMemoryRouter(
      [
        {
          path: '/',
          HydrateFallback: () => null,
          errorElement: <RouteErrorView />,
          lazy: async () => ({
            Component: (
              await vitePreload<{ BuilderPage: () => null }>(() =>
                Promise.reject(
                  new TypeError('Failed to fetch dynamically imported module: /assets/B.js'),
                ),
              )
            ).BuilderPage,
          }),
        },
      ],
      { initialEntries: ['/'] },
    );
    renderWithProviders(<RouterProvider router={router} />);
    await act(async () => {
      await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
      await vi.waitFor(() => expect(router.state.errors).not.toBeNull()); // error view's turn
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(error).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    uninstall();
  });
});
