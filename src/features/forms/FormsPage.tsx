import {
  ActionIcon,
  Button,
  Card,
  Checkbox,
  FileButton,
  Group,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { createEntry } from '../../db/entries';
import { deleteForm, listForms, putForms, saveForm } from '../../db/forms';
import { formatDate, todayLocal } from '../../domain/dates';
import type { MessageKey } from '../../i18n/de';
import { LIBRARY_ENABLED } from '../../config/features';
import { useLanguage, useT } from '../../i18n/I18nProvider';
import type { Form } from '../../schema/form';
import { PageLoader } from '../../layout/PageLoader';
import { shareText } from '../../services/share';
import { MAX_LINK_LENGTH, buildFormLink } from './formLink';
import type { FormCardAction } from './FormCardMenu';
import { MoreButton } from './MoreButton';
import type { ConflictAction } from './ImportConflictModal';
import { asCopy, dedupeIds, exportForms, planImport } from './importExport';
import type { ImportError } from './readImportFiles';

const DeleteFormModal = lazy(() =>
  import('./DeleteFormModal').then((m) => ({ default: m.DeleteFormModal })),
);
// The card menu (Menu, Popover, floating-ui) loads right after the first render, not with it.
const loadCardMenu = () => import('./FormCardMenu');
const FormCardMenu = lazy(() => loadCardMenu().then((m) => ({ default: m.FormCardMenu })));
const ImportConflictModal = lazy(() =>
  import('./ImportConflictModal').then((m) => ({ default: m.ImportConflictModal })),
);

const ERROR_KEYS = {
  invalidJson: 'forms.import.error.invalidJson',
  invalidStructure: 'forms.import.error.invalidStructure',
  unsupportedVersion: 'forms.import.error.unsupportedVersion',
  invalidForm: 'forms.import.error.invalidForm',
} as const satisfies Record<ImportError['code'], MessageKey>;

/** Outcome counts of one import run (all files picked so far, until every conflict is decided). */
type ImportTally = Record<'imported' | 'replaced' | 'skipped', number>;
const EMPTY_TALLY: ImportTally = { imported: 0, replaced: 0, skipped: 0 };

export function FormsPage() {
  const t = useT();
  const language = useLanguage();
  const navigate = useNavigate();
  const forms = useLiveQuery(async () => {
    const all = await listForms();
    return all.sort(
      (a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title),
    );
  });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [toDelete, setToDelete] = useState<Form | null>(null);
  const [conflicts, setConflicts] = useState<Form[]>([]);
  // Card whose "⋯" was tapped before the menu chunk arrived: it opens once loaded.
  const [pendingMenu, setPendingMenu] = useState<string | null>(null);
  useEffect(() => {
    void loadCardMenu();
  }, []);
  const tally = useRef<ImportTally>({ ...EMPTY_TALLY });
  // Conflicts still waiting for a decision (a ref: decisions resolve between renders).
  const openConflicts = useRef(0);

  if (!forms) return <PageLoader />;

  const titleOf = (form: Form) => form.title || t('forms.untitled');

  const fill = async (form: Form) => {
    const entry = await createEntry(form, 'own');
    await navigate(`/entries/${entry.id}`);
  };

  const duplicate = async (form: Form) => {
    await saveForm(asCopy(form, t));
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const { id } = toDelete;
    setToDelete(null);
    await deleteForm(id);
    setSelected((prev) => new Set([...prev].filter((s) => s !== id)));
  };

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const errorMessage = (e: ImportError): string =>
    t(ERROR_KEYS[e.code], {
      file: e.file,
      position: (e.index ?? 0) + 1,
      title: e.title ? t('forms.import.errorTitlePart', { title: e.title }) : '',
      path: e.path ? ` (${e.path})` : '',
    });

  const importFiles = async (files: File[]) => {
    if (files.length === 0) return;
    // Zod/parseFormFile stay out of the first-load chunk.
    const { readImportFiles } = await import('./readImportFiles');
    const result = await readImportFiles(files);
    for (const e of result.errors) {
      notifications.show({
        color: 'red',
        title: t('forms.import.errorTitle'),
        message: errorMessage(e),
      });
    }
    if (result.forms.length === 0) return;
    const existing = new Set((await listForms()).map((f) => f.id));
    const { fresh, conflicts: clashing } = planImport(existing, dedupeIds(result.forms, t));
    if (fresh.length > 0) {
      await putForms(fresh);
      tally.current.imported += fresh.length;
    }
    openConflicts.current += clashing.length;
    setConflicts((prev) => [...prev, ...clashing]);
    reportWhenDone();
  };

  /** One summary once the import and all its conflict decisions are done; only counts > 0. */
  const reportWhenDone = () => {
    if (openConflicts.current > 0) return;
    const done = tally.current;
    tally.current = { ...EMPTY_TALLY };
    const parts = (['imported', 'replaced', 'skipped'] as const)
      .filter((key) => done[key] > 0)
      .map((key) => t(`forms.import.summary.${key}`, { count: done[key] }));
    if (parts.length === 0) return;
    notifications.show({
      color: done.imported + done.replaced > 0 ? 'green' : 'gray',
      message: t('forms.import.summary', { parts: parts.join(', ') }),
    });
  };

  const resolveConflict = async (action: ConflictAction) => {
    const [current] = conflicts;
    if (!current) return;
    setConflicts((prev) => prev.slice(1));
    try {
      if (action === 'replace') {
        // Replaced now: it moves to the top of the list.
        await putForms([{ ...current, updatedAt: new Date().toISOString() }]);
        tally.current.replaced += 1;
      } else if (action === 'copy') {
        await putForms([asCopy(current, t)]);
        tally.current.imported += 1;
      } else {
        tally.current.skipped += 1;
      }
    } finally {
      openConflicts.current -= 1;
      reportWhenDone();
    }
  };

  const shareLink = async (form: Form) => {
    const url = await buildFormLink(form, window.location.href);
    if (url.length > MAX_LINK_LENGTH) {
      notifications.show({ color: 'red', message: t('forms.shareLink.tooLong') });
      return;
    }
    const result = await shareText(t('forms.shareLink.text', { title: titleOf(form), url }));
    if (result === 'failed') {
      notifications.show({ color: 'red', message: t('forms.shareLink.failed') });
    }
  };

  const runMenuAction = (action: FormCardAction, form: Form) => {
    setPendingMenu(null);
    if (action === 'shareLink') void shareLink(form);
    else if (action === 'duplicate') void duplicate(form);
    else if (action === 'exportFile') exportForms([form]);
    else setToDelete(form);
  };

  const exportSelection = () => exportForms(forms.filter((f) => selected.has(f.id)));

  return (
    <Stack>
      <Group>
        <Button onClick={() => void navigate('/forms/new')}>{t('forms.new')}</Button>
        <FileButton
          onChange={(files) => void importFiles(files)}
          accept=".json,application/json"
          multiple
        >
          {(props) => (
            <Button variant="default" {...props}>
              {t('forms.import')}
            </Button>
          )}
        </FileButton>
        <Button variant="default" disabled={selected.size === 0} onClick={exportSelection}>
          {t('forms.exportSelected')}
        </Button>
      </Group>

      {forms.length === 0 ? (
        <Stack align="flex-start">
          <Text c="dimmed">{t(LIBRARY_ENABLED ? 'forms.emptyWithLibrary' : 'forms.empty')}</Text>
        </Stack>
      ) : (
        forms.map((form) => (
          <Card key={form.id} withBorder pb="xs" className="bogen-list-card bogen-card-link">
            <Group align="flex-start" wrap="nowrap">
              <Checkbox
                className="bogen-card-control"
                aria-label={t('forms.select', { title: titleOf(form) })}
                checked={selected.has(form.id)}
                onChange={(e) => toggle(form.id, e.currentTarget.checked)}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Title order={3} size="h4" className="bogen-card-title">
                  {/* Stretched over the whole card via ::after (theme.css); the controls sit above it. */}
                  <UnstyledButton
                    className="bogen-card-action"
                    aria-label={t('forms.fillNamed', { title: titleOf(form) })}
                    onClick={() => void fill(form)}
                  >
                    {titleOf(form)}
                  </UnstyledButton>
                </Title>
                <Text c="dimmed" size="sm">
                  {t('forms.fieldCount', { count: form.fields.length })}
                </Text>
                <Text c="dimmed" size="sm">
                  {t('forms.updated', {
                    date: formatDate(todayLocal(new Date(form.updatedAt)), language),
                  })}
                </Text>
              </div>
              <Group gap={0} wrap="nowrap" className="bogen-card-control bogen-card-icons">
                <ActionIcon
                  variant="subtle"
                  size="xl"
                  aria-label={t('forms.editNamed', { title: titleOf(form) })}
                  onClick={() => void navigate(`/forms/${form.id}/edit`)}
                >
                  <span aria-hidden>✎</span>
                </ActionIcon>
                <Suspense
                  fallback={
                    <MoreButton
                      label={t('forms.more', { title: titleOf(form) })}
                      onClick={() => setPendingMenu(form.id)}
                    />
                  }
                >
                  <FormCardMenu
                    label={t('forms.more', { title: titleOf(form) })}
                    defaultOpened={pendingMenu === form.id}
                    onAction={(action) => runMenuAction(action, form)}
                  />
                </Suspense>
              </Group>
            </Group>
            <Text aria-hidden className="bogen-card-chevron" c="dimmed">
              ›
            </Text>
          </Card>
        ))
      )}

      <Suspense fallback={null}>
        {toDelete ? (
          <DeleteFormModal
            form={toDelete}
            onCancel={() => setToDelete(null)}
            onConfirm={() => void confirmDelete()}
          />
        ) : null}
        {conflicts[0] ? (
          <ImportConflictModal
            form={conflicts[0]}
            onResolve={(action) => void resolveConflict(action)}
          />
        ) : null}
      </Suspense>
    </Stack>
  );
}
