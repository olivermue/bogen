import { Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { createEntry } from '../../db/entries';
import { saveForm } from '../../db/forms';
import { useT } from '../../i18n/I18nProvider';
import type { Form } from '../../schema/form';
import { exportForms } from '../forms/importExport';
import { copyLibraryForm, loadLibrary } from './loadLibrary';

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; forms: Form[] };

export function LibraryPage() {
  const t = useT();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    loadLibrary().then(
      (forms) => {
        if (active) setState({ status: 'ready', forms });
      },
      () => {
        if (active) setState({ status: 'error' });
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const fill = async (form: Form) => {
    const entry = await createEntry(form, 'library');
    await navigate(`/entries/${entry.id}`);
  };

  const copy = async (form: Form) => {
    const saved = await saveForm(copyLibraryForm(form));
    await navigate(`/forms/${saved.id}/edit`);
  };

  if (state.status === 'loading') return null;
  if (state.status === 'error') return <Text c="red">{t('library.loadError')}</Text>;
  if (state.forms.length === 0) return <Text c="dimmed">{t('library.empty')}</Text>;

  return (
    <Stack>
      {state.forms.map((form) => (
        <Card key={form.id} withBorder className="bogen-list-card">
          <Title order={3} size="h4">
            {form.title}
          </Title>
          {form.description ? <Text c="dimmed">{form.description}</Text> : null}
          <Group mt="sm">
            <Button onClick={() => void fill(form)}>{t('library.fill')}</Button>
            <Button variant="default" onClick={() => void copy(form)}>
              {t('library.copy')}
            </Button>
            <Button variant="default" onClick={() => exportForms([form])}>
              {t('library.export')}
            </Button>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}
