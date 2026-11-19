import { Alert, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { getForm, putForms } from '../../db/forms';
import { useT } from '../../i18n/I18nProvider';
import { PageLoader } from '../../layout/PageLoader';
import type { Form } from '../../schema/form';
import { parseFormFile } from '../../schema/formFile';
import { LINK_VERSION, decodeFormPayload } from './formLink';
import { asCopy } from './importExport';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; reason: 'invalid' | 'unsupported' }
  | { kind: 'ready'; form: Form; exists: boolean };

async function readLink(params: URLSearchParams): Promise<State> {
  const version = Number(params.get('v'));
  const payload = params.get('d');
  if (!payload || !Number.isInteger(version)) return { kind: 'error', reason: 'invalid' };
  if (version > LINK_VERSION) return { kind: 'error', reason: 'unsupported' };
  if (version !== LINK_VERSION) return { kind: 'error', reason: 'invalid' };
  let text: string;
  try {
    text = await decodeFormPayload(payload);
  } catch {
    return { kind: 'error', reason: 'invalid' };
  }
  const { forms, errors } = parseFormFile(text);
  const [form] = forms;
  if (errors.some((e) => e.code === 'unsupportedVersion')) {
    return { kind: 'error', reason: 'unsupported' };
  }
  if (!form || forms.length !== 1 || errors.length > 0) return { kind: 'error', reason: 'invalid' };
  return { kind: 'ready', form, exists: (await getForm(form.id)) !== undefined };
}

/**
 * Target of shared template links (`#/import?v=1&d=…`, see formLink.ts): shows what the link
 * contains and imports it only after the user confirms.
 */
export function ImportLinkPage() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const query = params.toString();

  useEffect(() => {
    let active = true;
    void readLink(new URLSearchParams(query)).then(
      (next) => {
        if (active) setState(next);
      },
      () => {
        if (active) setState({ kind: 'error', reason: 'invalid' });
      },
    );
    return () => {
      active = false;
    };
  }, [query]);

  // Replace: the import link should not stay in the history (Back would offer the import again).
  const toForms = () => void navigate('/forms', { replace: true });

  if (state.kind === 'loading') return <PageLoader />;

  if (state.kind === 'error') {
    return (
      <Stack align="flex-start">
        <Alert color="red" title={t('forms.import.errorTitle')}>
          {t(state.reason === 'unsupported' ? 'importLink.unsupported' : 'importLink.invalid')}
        </Alert>
        <Button variant="default" onClick={toForms}>
          {t('importLink.toForms')}
        </Button>
      </Stack>
    );
  }

  const { form, exists } = state;
  const title = form.title || t('forms.untitled');

  const save = async (action: 'new' | 'replace' | 'copy') => {
    if (busy) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const stored =
        action === 'copy'
          ? asCopy(form, t)
          : action === 'replace'
            ? { ...form, updatedAt: now }
            : form;
      await putForms([stored]);
      notifications.show({
        color: 'green',
        message: t('importLink.done', { title: stored.title || t('forms.untitled') }),
      });
      toForms();
    } catch (error) {
      console.error('Link import failed', error);
      notifications.show({ color: 'red', message: t('importLink.invalid') });
      setBusy(false);
    }
  };

  return (
    <Stack>
      <Text>{t('importLink.intro')}</Text>
      <Card withBorder>
        <Title order={3} size="h4">
          {title}
        </Title>
        <Text c="dimmed" size="sm">
          {t('forms.fieldCount', { count: form.fields.length })}
        </Text>
      </Card>
      {exists ? <Text>{t('importLink.exists', { title })}</Text> : null}
      <Group>
        {exists ? (
          <>
            <Button color="red" loading={busy} onClick={() => void save('replace')}>
              {t('forms.conflict.replace')}
            </Button>
            <Button variant="default" disabled={busy} onClick={() => void save('copy')}>
              {t('forms.conflict.copy')}
            </Button>
          </>
        ) : (
          <Button loading={busy} onClick={() => void save('new')}>
            {t('importLink.accept')}
          </Button>
        )}
        <Button variant="default" disabled={busy} onClick={toForms}>
          {t('forms.cancel')}
        </Button>
      </Group>
    </Stack>
  );
}
