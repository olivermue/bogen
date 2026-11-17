import { notifications } from '@mantine/notifications';
import { Anchor, Button, Divider, Stack, Text, Title } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { LIBRARY_ENABLED } from '../../config/features';
import type { Entry } from '../../db/db';
import { deleteEntry, getEntry, updateAnswers } from '../../db/entries';
import { isAnswered } from '../../domain/validation';
import { useT } from '../../i18n/I18nProvider';
import type { Answers, AnswerValue, Form } from '../../schema/form';
import { FormFields } from './fields/FieldInput';
import { fieldDomId } from './fields/types';
import { OutputActions } from './OutputActions';
import { prefillAnswers } from './prefill';
import { useAutosave } from './useAutosave';

function focusField(fieldId: string) {
  const el = document.getElementById(fieldDomId(fieldId));
  if (!el) return;
  el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  el.querySelector<HTMLElement>('input:not([type=hidden]), textarea, select, button')?.focus({
    preventScroll: true,
  });
}

/** Never saved or shared, no answers yet. */
function isFreshEntry(entry: Entry): boolean {
  return (
    Object.keys(entry.answers).length === 0 &&
    entry.updatedAt === entry.createdAt &&
    entry.sharedAt === null
  );
}

/**
 * True when the person has entered nothing: every field is unanswered (`isAnswered`) or still
 * holds its untouched default (`defaultToday`). Used to discard an abandoned entry.
 */
function hasNoUserInput(form: Form, answers: Answers, defaults: Answers | null): boolean {
  return form.fields.every((field) => {
    const value = answers[field.id];
    if (!isAnswered(field, value)) return true;
    return defaults !== null && Object.hasOwn(defaults, field.id) && defaults[field.id] === value;
  });
}

/**
 * Is there an earlier in-app history entry to go back to? Browser history stores its index in
 * `history.state.idx`; without it (memory router) the initial location is the only one with
 * the key "default".
 */
function canGoBack(locationKey: string): boolean {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === 'number' ? idx > 0 : locationKey !== 'default';
}

/** Always renders `entry.formSnapshot`, never the current version of the form. */
function FillForm(props: { entry: Entry }) {
  const { entry } = props;
  const form = entry.formSnapshot;
  // Defaults (date "today") only for a fresh entry: never touch an existing one on reopen
  // (that would invent an answer and clear its sharedAt).
  const [prefilled] = useState(() =>
    isFreshEntry(entry) ? prefillAnswers(form, entry.answers) : null,
  );
  const [answers, setAnswers] = useState<Answers>(prefilled ?? entry.answers);
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(new Map());
  // While copy/share runs the fields are locked: an edit made then could be lost when the
  // entry is deleted right after ('immediately').
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const navigate = useNavigate();
  const { key: locationKey } = useLocation();
  const t = useT();
  const autosaveNoticeId = `autosave-failed-${entry.id}`;
  const flush = useAutosave(entry.id, answers, {
    restoreFrom: entry,
    // The entry was removed meanwhile (cleanup or another tab) and has just been put back.
    onRestored: () => notifications.show({ color: 'yellow', message: t('fill.entryRestored') }),
    // One persistent warning while saving fails; it disappears after the next successful write.
    onFailingChange: (failing) => {
      if (failing) {
        notifications.show({
          id: autosaveNoticeId,
          color: 'red',
          autoClose: false,
          message: t('fill.autosaveFailed'),
        });
      } else {
        notifications.hide(autosaveNoticeId);
      }
    },
  });
  const startedFresh = useRef(isFreshEntry(entry));

  // Back button: return to where the person came from. An entry that was never started is
  // discarded (only if untouched, never shared, and the stored answers hold no input). When
  // anything is uncertain (e.g. the flush failed) the entry stays.
  const back = async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true); // lock the fields: a keystroke now could be autosaved and then deleted
    try {
      await flush();
    } catch (error) {
      // The last answer may exist only in memory: stay, so nothing is lost.
      console.error('Could not save before leaving', error);
      notifications.show({ color: 'red', message: t('fill.saveFailed') });
      leavingRef.current = false;
      setLeaving(false);
      return;
    }
    try {
      const stored = await getEntry(entry.id);
      if (
        stored &&
        startedFresh.current &&
        stored.sharedAt === null &&
        hasNoUserInput(form, stored.answers, prefilled)
      ) {
        await deleteEntry(entry.id);
      }
    } catch (error) {
      console.error('Could not check the entry before leaving', error);
    }
    if (canGoBack(locationKey)) await navigate(-1);
    else await navigate(LIBRARY_ENABLED && entry.formSource === 'library' ? '/library' : '/forms');
  };

  // Autosave treats the initial answers as stored, so persist the defaults once here.
  useEffect(() => {
    if (!prefilled) return;
    updateAnswers(entry.id, prefilled, entry).catch((error: unknown) =>
      console.error('Could not store default answers', error),
    );
  }, [entry, prefilled]);

  const change = (fieldId: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => {
      if (!prev.has(fieldId)) return prev;
      const next = new Map(prev);
      next.delete(fieldId);
      return next;
    });
  };

  return (
    <Stack gap="lg" maw={800}>
      <Button
        variant="subtle"
        w="fit-content"
        ml="calc(var(--mantine-spacing-xs) * -1)"
        disabled={busy || leaving}
        leftSection={<span aria-hidden>{'‹'}</span>}
        onClick={() => void back()}
      >
        {t('nav.back')}
      </Button>
      <div>
        <Title order={2}>{form.title}</Title>
        {form.description && (
          <Text c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
            {form.description}
          </Text>
        )}
      </div>
      <FormFields
        fields={form.fields}
        answers={answers}
        errors={errors}
        onChange={change}
        disabled={busy || leaving}
      />
      <Divider />
      <OutputActions
        entryId={entry.id}
        form={form}
        answers={answers}
        flush={flush}
        onBusyChange={setBusy}
        onInvalid={(next) => {
          setErrors(next);
          const first = next.keys().next().value;
          if (first !== undefined) focusField(first);
        }}
      />
    </Stack>
  );
}

/** Route `/entries/:entryId`. */
export function FillPage() {
  const t = useT();
  const { entryId = '' } = useParams();
  const [loaded, setLoaded] = useState<{ id: string; entry: Entry | undefined } | null>(null);

  useEffect(() => {
    let active = true;
    getEntry(entryId).then(
      (entry) => {
        if (active) setLoaded({ id: entryId, entry });
      },
      (error: unknown) => {
        console.error('Could not load entry', error);
        if (active) setLoaded({ id: entryId, entry: undefined });
      },
    );
    return () => {
      active = false;
    };
  }, [entryId]);

  if (loaded?.id !== entryId) return <Text c="dimmed">{t('fill.loading')}</Text>;
  if (!loaded.entry) {
    return (
      <Stack gap="sm">
        <Text>{t('fill.notFound')}</Text>
        <Anchor component={Link} to="/entries">
          {t('fill.toEntries')}
        </Anchor>
      </Stack>
    );
  }
  return <FillForm key={loaded.entry.id} entry={loaded.entry} />;
}
