import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { notifications, notificationsStore } from '@mantine/notifications';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { vi } from 'vitest';
import { AppProviders } from '../AppProviders';
import { de } from '../i18n/de';
import { en } from '../i18n/en';
import { renderWithProviders } from '../test/render';
import { registerPendingWrite, registerUnsavedWork } from './pendingWrites';
import { UpdateIndicator } from './UpdateIndicator';
import { UpdatePrompt } from './UpdatePrompt';
import { resetUpdateState, setUpdateWaiting } from './updateState';

const registerState = vi.hoisted(() => ({
  needRefresh: true,
  updateServiceWorker: vi.fn<(reload?: boolean) => Promise<void>>(),
  options: undefined as RegisterSWOptions | undefined,
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options: RegisterSWOptions) => {
    registerState.options = options;
    return {
      needRefresh: [registerState.needRefresh, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: registerState.updateServiceWorker,
    };
  },
}));

afterEach(() => {
  notifications.clean();
  registerState.needRefresh = true;
  registerState.options = undefined;
  registerState.updateServiceWorker.mockReset().mockResolvedValue(undefined);
  act(() => resetUpdateState());
  vi.useRealTimers();
});

describe('UpdatePrompt', () => {
  it('shows a reload button when an update is available and reloads on click', async () => {
    renderWithProviders(<UpdatePrompt />);
    expect(await screen.findByText('Neue Version verfügbar')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Neu laden' }));
    await waitFor(() => expect(registerState.updateServiceWorker).toHaveBeenCalledWith(true));
  });

  it('shows English text', async () => {
    renderWithProviders(<UpdatePrompt />, { language: 'en' });
    expect(await screen.findByText('New version available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('shows nothing and does not reload when no update is available', () => {
    registerState.needRefresh = false;
    renderWithProviders(
      <>
        <UpdatePrompt />
        <UpdateIndicator />
      </>,
    );
    expect(screen.queryByText('Neue Version verfügbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aktualisieren' })).not.toBeInTheDocument();
    expect(registerState.updateServiceWorker).not.toHaveBeenCalled();
  });

  it('keeps a header indicator after the notification is closed; it applies the update', async () => {
    renderWithProviders(
      <>
        <UpdatePrompt />
        <UpdateIndicator />
      </>,
    );
    const notification = await screen.findByText('Neue Version verfügbar');
    const close = notification
      .closest('.mantine-Notification-root')
      ?.querySelector<HTMLButtonElement>('.mantine-Notification-closeButton');
    expect(close).toBeTruthy();
    await userEvent.click(close!);
    // The store drops it at once; the DOM node only lingers for the exit transition.
    expect(notificationsStore.getState().notifications).toHaveLength(0);

    const indicator = screen.getByRole('button', { name: 'Aktualisieren' });
    await userEvent.click(indicator);
    await waitFor(() => expect(registerState.updateServiceWorker).toHaveBeenCalledWith(true));
  });

  it('saves all pending answers before activating the new version', async () => {
    let finishWrite!: () => void;
    const off = registerPendingWrite(() => new Promise<void>((r) => (finishWrite = r)));
    registerState.needRefresh = false;
    renderWithProviders(
      <>
        <UpdatePrompt />
        <UpdateIndicator />
      </>,
    );
    act(() => setUpdateWaiting(true));
    await userEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));
    expect(registerState.updateServiceWorker).not.toHaveBeenCalled();
    finishWrite();
    await waitFor(() => expect(registerState.updateServiceWorker).toHaveBeenCalledWith(true));
    off();
  });

  it('shows an error and does not update if the answers could not be saved', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const off = registerPendingWrite(() => Promise.reject(new Error('quota')));
    registerState.needRefresh = false;
    renderWithProviders(
      <>
        <UpdatePrompt />
        <UpdateIndicator />
      </>,
    );
    act(() => setUpdateWaiting(true));
    await userEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));
    expect(
      await screen.findByText(/Antworten konnten nicht gespeichert werden/),
    ).toBeInTheDocument();
    expect(registerState.updateServiceWorker).not.toHaveBeenCalled();
    off();
    error.mockRestore();
  });

  it('explains that unsaved builder changes block the update', async () => {
    const off = registerUnsavedWork();
    registerState.needRefresh = false;
    renderWithProviders(
      <>
        <UpdatePrompt />
        <UpdateIndicator />
      </>,
    );
    act(() => setUpdateWaiting(true));
    await userEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));
    expect(await screen.findByText(/Im Generator gibt es ungespeicherte/)).toBeInTheDocument();
    expect(registerState.updateServiceWorker).not.toHaveBeenCalled();
    off();
  });

  it('keeps the problem notice on a language change; only closing it dismisses it', async () => {
    const off = registerUnsavedWork();
    registerState.needRefresh = false;
    const tree = (
      <>
        <UpdatePrompt />
        <UpdateIndicator />
      </>
    );
    const { rerender } = renderWithProviders(tree);
    act(() => setUpdateWaiting(true));
    await userEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));
    expect(await screen.findByText(/Im Generator gibt es ungespeicherte/)).toBeInTheDocument();

    rerender(
      <AppProviders language="en" messages={en}>
        {tree}
      </AppProviders>,
    );
    expect(await screen.findByText(/The form builder has unsaved changes/)).toBeInTheDocument();
    expect(notificationsStore.getState().notifications.map((n) => n.id)).toContain(
      'pwa-update-problem',
    );

    const close = screen
      .getByText(/The form builder has unsaved changes/)
      .closest('.mantine-Notification-root')
      ?.querySelector<HTMLButtonElement>('.mantine-Notification-closeButton');
    await userEvent.click(close!);
    expect(notificationsStore.getState().notifications.map((n) => n.id)).not.toContain(
      'pwa-update-problem',
    );
    // Dismissed for good: a re-render (e.g. another language change) does not bring it back.
    rerender(
      <AppProviders language="de" messages={de}>
        {tree}
      </AppProviders>,
    );
    await waitFor(() =>
      expect(screen.queryByText(/Im Generator gibt es ungespeicherte/)).not.toBeInTheDocument(),
    );
    off();
  });

  it('offers "reload anyway" when saving hangs for 10 s, and clears the busy state', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const off = registerPendingWrite(() => new Promise<void>(() => {}));
    registerState.needRefresh = false;
    renderWithProviders(
      <>
        <UpdatePrompt />
        <UpdateIndicator />
      </>,
    );
    act(() => setUpdateWaiting(true));
    const indicator = screen.getByRole('button', { name: 'Aktualisieren' });
    await user.click(indicator);
    expect(indicator).toHaveAttribute('data-loading');
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(await screen.findByText(/dauert ungewöhnlich lange/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aktualisieren' })).not.toHaveAttribute(
      'data-loading',
    );
    expect(registerState.updateServiceWorker).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Trotzdem neu laden' }));
    expect(registerState.updateServiceWorker).toHaveBeenCalledWith(true);
    off();
  });

  it('checks for updates hourly once registered and stops on unmount', () => {
    vi.useFakeTimers();
    registerState.needRefresh = false;
    const { unmount } = renderWithProviders(<UpdatePrompt />);
    const registration = {
      installing: null,
      update: vi.fn(() => Promise.resolve()),
    } as unknown as ServiceWorkerRegistration;
    act(() => registerState.options?.onRegisteredSW?.('/sw.js', registration));
    act(() => vi.advanceTimersByTime(60 * 60 * 1000));
    expect(registration.update).toHaveBeenCalledTimes(1);
    unmount();
    vi.advanceTimersByTime(3 * 60 * 60 * 1000);
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('passes its own reload handler so the plugin never reloads without saving first', () => {
    renderWithProviders(<UpdatePrompt />);
    expect(registerState.options?.onNeedReload).toBeTypeOf('function');
  });
});
