import { Alert, Badge, Button, Group, NativeSelect, Stack, Text } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import {
  isStoragePersisted,
  requestPersistentStorage,
  saveSettings,
  useSettings,
  type CopyFormat,
  type DeleteAfterShare,
  type Settings,
} from '../../db/settings';
import type { MessageKey } from '../../i18n/de';
import type { LanguageSetting } from '../../i18n/detect';
import { useT } from '../../i18n/I18nProvider';

const LANGUAGES: LanguageSetting[] = ['auto', 'de', 'en'];
const DELETE_VALUES: DeleteAfterShare[] = ['never', 'immediately', '1d', '7d', '30d'];
const COPY_FORMATS: CopyFormat[] = ['text', 'markdown', 'html', 'whatsapp'];
const SCHEMES: Settings['colorScheme'][] = ['auto', 'light', 'dark'];

export function SettingsPage() {
  const t = useT();
  const settings = useSettings();
  const [persisted, setPersisted] = useState<boolean | undefined>(undefined);

  const [busy, setBusy] = useState(false);
  // The browser turned the last "Ask again" down: say so (otherwise nothing visibly happens).
  const [denied, setDenied] = useState(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    void isStoragePersisted().then((value) => {
      if (mounted.current) setPersisted(value);
    });
    return () => {
      mounted.current = false;
    };
  }, []);

  const retryPersist = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setDenied(false);
    try {
      const granted = await requestPersistentStorage();
      const value = await isStoragePersisted();
      if (mounted.current) {
        setPersisted(value);
        setDenied(!granted && !value);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  if (!settings) return null;

  const options = (prefix: string, values: string[]) =>
    values.map((value) => ({ value, label: t(`${prefix}.${value}` as MessageKey) }));

  return (
    <Stack maw={480}>
      <NativeSelect
        label={t('settings.language')}
        data={options('settings.language', LANGUAGES)}
        value={settings.language}
        onChange={(e) => void saveSettings({ language: e.currentTarget.value as LanguageSetting })}
      />
      <NativeSelect
        label={t('settings.deleteAfterShare')}
        data={options('settings.deleteAfterShare', DELETE_VALUES)}
        value={settings.deleteAfterShare}
        onChange={(e) =>
          void saveSettings({ deleteAfterShare: e.currentTarget.value as DeleteAfterShare })
        }
      />
      <NativeSelect
        label={t('settings.copyFormat')}
        data={options('settings.copyFormat', COPY_FORMATS)}
        value={settings.copyFormat}
        onChange={(e) => void saveSettings({ copyFormat: e.currentTarget.value as CopyFormat })}
      />
      <NativeSelect
        label={t('settings.colorScheme')}
        data={options('settings.colorScheme', SCHEMES)}
        value={settings.colorScheme}
        onChange={(e) =>
          void saveSettings({ colorScheme: e.currentTarget.value as Settings['colorScheme'] })
        }
      />
      <Group gap="xs">
        <Text size="sm">{t('settings.storage')}</Text>
        {persisted !== undefined && (
          <Badge color={persisted ? 'green' : 'gray'} variant="light">
            {t(persisted ? 'settings.storage.persisted' : 'settings.storage.notPersisted')}
          </Badge>
        )}
      </Group>
      {persisted === false && (
        <Alert variant="light" color="gray">
          <Stack gap="xs" align="flex-start">
            <Text size="sm">{t('settings.storage.hint')}</Text>
            <Button size="xs" variant="default" loading={busy} onClick={() => void retryPersist()}>
              {t('settings.storage.retry')}
            </Button>
            <Text size="sm" c="dimmed" role="status">
              {denied ? t('settings.storage.denied') : null}
            </Text>
          </Stack>
        </Alert>
      )}
    </Stack>
  );
}
