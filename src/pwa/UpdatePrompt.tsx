import { Button, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useT } from '../i18n/I18nProvider';
import { startUpdateChecks } from './updateChecks';
import {
  connectUpdater,
  dismissUpdateProblem,
  forceUpdate,
  handleNeedReload,
  setUpdateWaiting,
  useUpdateProblem,
} from './updateState';
import { useApplyUpdate } from './useApplyUpdate';

const NOTIFICATION_ID = 'pwa-update';
const PROBLEM_ID = 'pwa-update-problem';

/**
 * Registers the service worker (the only `useRegisterSW` caller) and feeds the shared update
 * state. Shows a closable notification when a new worker is waiting; the header indicator
 * (`UpdateIndicator`) and the About page keep the update reachable after it was closed.
 * Checks for updates actively (hourly and on visibility). The plugin's automatic reload is
 * replaced by `handleNeedReload`, which saves pending answers first. Shows a notification if
 * saving before an update fails or takes longer than SAVE_TIMEOUT_MS.
 */
export function UpdatePrompt() {
  const t = useT();
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, r) => setRegistration(r),
    onNeedReload: () => void handleNeedReload(),
  });
  const { apply, busy } = useApplyUpdate();
  const problem = useUpdateProblem();

  useEffect(() => {
    connectUpdater({ updateServiceWorker });
  }, [updateServiceWorker]);

  useEffect(() => {
    if (!registration) return;
    connectUpdater({ registration });
    return startUpdateChecks(registration);
  }, [registration]);

  useEffect(() => {
    setUpdateWaiting(needRefresh);
  }, [needRefresh]);

  useEffect(() => {
    if (!needRefresh) return;
    notifications.show({
      id: NOTIFICATION_ID,
      autoClose: false,
      withCloseButton: true,
      title: t('pwa.updateAvailable'),
      message: (
        <Group mt="xs">
          <Button size="xs" loading={busy} onClick={apply}>
            {t('pwa.reload')}
          </Button>
        </Group>
      ),
    });
    return () => {
      notifications.hide(NOTIFICATION_ID);
    };
  }, [needRefresh, t, apply, busy]);

  // Saving before the update failed or hangs: tell the person; after a timeout they may decide to
  // reload anyway (never done silently, it may lose the last answers).
  // Only the person closing it dismisses the problem: the cleanup below (language or problem
  // changed, unmount) hides the notification as well, and Mantine calls onClose for that too.
  useEffect(() => {
    if (!problem) return;
    let replacing = false;
    notifications.show({
      id: PROBLEM_ID,
      color: 'red',
      autoClose: false,
      withCloseButton: true,
      onClose: () => {
        if (!replacing) dismissUpdateProblem();
      },
      message:
        problem === 'timeout' ? (
          <>
            {t('pwa.saveTimeout')}
            <Group mt="xs">
              <Button size="xs" color="red" onClick={() => void forceUpdate()}>
                {t('pwa.reloadAnyway')}
              </Button>
            </Group>
          </>
        ) : problem === 'notActivated' ? (
          <>
            {t('pwa.notActivated')}
            <Group mt="xs">
              <Button size="xs" color="red" loading={busy} onClick={() => void handleNeedReload()}>
                {t('pwa.reload')}
              </Button>
            </Group>
          </>
        ) : problem === 'unsaved' ? (
          t('pwa.unsavedBuilder')
        ) : (
          t('pwa.saveFailed')
        ),
    });
    return () => {
      replacing = true;
      notifications.hide(PROBLEM_ID);
    };
  }, [problem, t, busy]);

  return null;
}
