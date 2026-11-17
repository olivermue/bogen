import { Button, Group, Stack, Text, Title } from '@mantine/core';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouteError } from 'react-router';
import { useT } from '../i18n/I18nProvider';
import {
  isChunkLoadError,
  isOnline,
  isReloadScheduled,
  recoverFromChunkError,
  reloadPage,
  resetApp,
  subscribeOnline,
} from './chunkErrorRecovery';

/**
 * Route error element. A chunk load error (old tab after a release) first triggers one automatic
 * reload; only if that did not help, or for any other error, the view with "Reload" and
 * "Reset app" is shown. Reset deletes only this app's caches and worker, never the data.
 * While a recovery reload is underway, any error renders nothing (the page is about to go).
 * `recoverFromChunkError` is idempotent per document, so StrictMode's double call is harmless.
 */
export function RouteErrorView() {
  const t = useT();
  const error = useRouteError();
  const chunk = isChunkLoadError(error);
  const [reloading] = useState(() => (chunk ? recoverFromChunkError() : isReloadScheduled()));
  const [resetting, setResetting] = useState(false);
  const online = useSyncExternalStore(subscribeOnline, isOnline);

  useEffect(() => {
    if (!reloading) console.error('Route error', error);
  }, [reloading, error]);

  if (reloading) return null;

  return (
    <Stack maw={560} p="md" role="alert">
      <Title order={1} size="h3">
        {t(chunk ? 'error.chunk.title' : 'error.generic.title')}
      </Title>
      <Text>{t(chunk ? 'error.chunk.text' : 'error.generic.text')}</Text>
      <Group>
        <Button onClick={reloadPage}>{t('error.reload')}</Button>
        <Button
          variant="default"
          loading={resetting}
          disabled={!online}
          onClick={() => {
            setResetting(true);
            void resetApp();
          }}
        >
          {t('error.reset')}
        </Button>
      </Group>
      {!online && (
        <Text size="sm" c="dimmed">
          {t('error.resetOffline')}
        </Text>
      )}
    </Stack>
  );
}
