import { Anchor, Button, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import type { MessageKey } from '../../i18n/de';
import { COPYRIGHT_HOLDER } from '../../config/legal';
import { useT } from '../../i18n/I18nProvider';
import { checkForUpdate, useUpdateAvailable, type UpdateCheckResult } from '../../pwa/updateState';
import { useApplyUpdate } from '../../pwa/useApplyUpdate';

const REPO_URL = import.meta.env.VITE_PUBLIC_REPO_URL;

const CHECK_RESULT: Record<UpdateCheckResult, MessageKey> = {
  found: 'about.update.found',
  latest: 'about.update.latest',
  failed: 'about.update.failed',
};

/** Fixed update entry: the only way to update in a standalone PWA without a reload button. */
function UpdateSection() {
  const t = useT();
  const available = useUpdateAvailable();
  const { apply, busy } = useApplyUpdate();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UpdateCheckResult>();

  if (available) {
    return (
      <Button w="fit-content" loading={busy} onClick={apply}>
        {t('about.update.apply')}
      </Button>
    );
  }
  return (
    <>
      <Button
        w="fit-content"
        variant="default"
        loading={checking}
        onClick={() => {
          setChecking(true);
          setResult(undefined);
          void checkForUpdate().then((r) => {
            setChecking(false);
            setResult(r);
          });
        }}
      >
        {t('about.update.check')}
      </Button>
      {result ? (
        <Text size="sm" role="status">
          {t(CHECK_RESULT[result])}
        </Text>
      ) : null}
    </>
  );
}

/** Renders `[B]aukasten`-style markers as highlighted letters (React elements, no HTML). */
function Highlighted(props: { text: string }) {
  const parts = props.text.split(/\[(.)\]/);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <Text key={i} span fw={700} c="var(--mantine-primary-color-filled)" data-acronym>
        {part}
      </Text>
    ) : (
      part
    ),
  );
}

export function AboutPage() {
  const t = useT();
  return (
    <Stack maw={560}>
      <Title order={2}>{t('app.title')}</Title>
      <Text>
        <Highlighted text={t('app.subtitle')} />
      </Text>
      <Text c="dimmed">{t('about.version', { version: __APP_VERSION__, sha: __GIT_SHA__ })}</Text>
      <UpdateSection />
      {REPO_URL ? (
        <Anchor href={REPO_URL} target="_blank" rel="noopener noreferrer">
          {t('about.repo')}
        </Anchor>
      ) : null}
      <Text size="sm">{t('about.copyright', { holder: COPYRIGHT_HOLDER })}</Text>
    </Stack>
  );
}
