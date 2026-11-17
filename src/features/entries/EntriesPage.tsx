import { Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Entry } from '../../db/db';
import { deleteEntry, listEntries } from '../../db/entries';
import { formatDate, formatTime, todayLocal } from '../../domain/dates';
import { missingRequired } from '../../domain/validation';
import { useLanguage, useT } from '../../i18n/I18nProvider';
import { PageLoader } from '../../layout/PageLoader';

const DeleteEntryModal = lazy(() =>
  import('./DeleteEntryModal').then((m) => ({ default: m.DeleteEntryModal })),
);

const pad = (n: number): string => String(n).padStart(2, '0');

export function EntriesPage() {
  const t = useT();
  const language = useLanguage();
  const navigate = useNavigate();
  const entries = useLiveQuery(() => listEntries(), []);
  const [toDelete, setToDelete] = useState<Entry | null>(null);

  if (!entries) return <PageLoader />;

  /** ISO instant -> local date + time. */
  const stamp = (iso: string): string => {
    const d = new Date(iso);
    return `${formatDate(todayLocal(d), language)} ${formatTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`, language)}`;
  };
  const titleOf = (e: Entry) => e.formSnapshot.title || t('forms.untitled');

  const confirmDelete = async () => {
    if (!toDelete) return;
    const { id } = toDelete;
    setToDelete(null);
    await deleteEntry(id);
  };

  if (entries.length === 0) {
    return (
      <Stack align="flex-start">
        <Text c="dimmed">{t('entries.empty')}</Text>
        <Button component={Link} to="/forms">
          {t('entries.toForms')}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack>
      {entries.map((entry) => {
        const complete = missingRequired(entry.formSnapshot, entry.answers).length === 0;
        return (
          <Card key={entry.id} withBorder className="bogen-list-card">
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <div>
                <Title order={3} size="h4">
                  {titleOf(entry)}
                </Title>
                <Text c="dimmed" size="sm">
                  {t('entries.updated', { date: stamp(entry.updatedAt) })}
                </Text>
                {entry.sharedAt ? (
                  <Text c="dimmed" size="sm">
                    {t('entries.shared', { date: stamp(entry.sharedAt) })}
                  </Text>
                ) : null}
              </div>
              <Badge color={complete ? 'green' : 'yellow'}>
                {t(complete ? 'entries.status.complete' : 'entries.status.inProgress')}
              </Badge>
            </Group>
            <Group mt="sm" gap="xs">
              <Button onClick={() => void navigate(`/entries/${entry.id}`)}>
                {t('entries.open')}
              </Button>
              <Button variant="default" color="red" onClick={() => setToDelete(entry)}>
                {t('forms.delete')}
              </Button>
            </Group>
          </Card>
        );
      })}
      <Suspense fallback={null}>
        {toDelete ? (
          <DeleteEntryModal
            title={titleOf(toDelete)}
            onCancel={() => setToDelete(null)}
            onConfirm={() => void confirmDelete()}
          />
        ) : null}
      </Suspense>
    </Stack>
  );
}
