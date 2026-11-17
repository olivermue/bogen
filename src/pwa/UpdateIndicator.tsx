import { Button } from '@mantine/core';
import { useT } from '../i18n/I18nProvider';
import { useApplyUpdate } from './useApplyUpdate';
import { useUpdateAvailable } from './updateState';

/**
 * Header button shown as long as a new version is waiting. Unlike the notification it cannot be
 * closed, so the update stays reachable (standalone PWAs have no reload button).
 */
export function UpdateIndicator() {
  const t = useT();
  const available = useUpdateAvailable();
  const { apply, busy } = useApplyUpdate();
  if (!available) return null;
  return (
    <Button
      size="compact-sm"
      variant="white"
      ml="auto"
      style={{ flexShrink: 0 }}
      title={t('pwa.updateAvailable')}
      loading={busy}
      onClick={apply}
    >
      {t('pwa.indicator')}
    </Button>
  );
}
