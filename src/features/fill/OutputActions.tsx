import { Button, Group, SegmentedControl, Skeleton, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { getEntry } from '../../db/entries';
import { getSettings, useSettings, type CopyFormat } from '../../db/settings';
import { formatEntry } from '../../domain/output';
import { useLanguage, useT } from '../../i18n/I18nProvider';
import type { Answers, Form } from '../../schema/form';
import { afterSuccessfulShare } from '../../services/afterShare';
import { copyToClipboard } from '../../services/clipboard';
import { shareText } from '../../services/share';
import { validateAnswers } from './validateAnswers';

const FORMATS: CopyFormat[] = ['text', 'markdown', 'html'];

/**
 * Format choice, "Copy" and "Share" for one entry.
 *
 * Order per action: validate -> issue the pending autosave write (`flush()`, synchronous
 * start) -> copy/share right away (still inside the user gesture, which Safari requires for
 * clipboard and share) -> wait for the write -> re-read the entry -> afterSuccessfulShare.
 * Only 'copied' / 'shared' / 'fallback' count as success; 'cancelled' does nothing and
 * 'failed' only shows an error.
 */
export function OutputActions(props: {
  entryId: string;
  form: Form;
  answers: Answers;
  flush: () => Promise<void>;
  onInvalid: (errors: Map<string, string>) => void;
  /** True while copy/share runs; the page locks its fields meanwhile. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const { entryId, form, answers, flush, onInvalid, onBusyChange } = props;
  const t = useT();
  const lang = useLanguage();
  const navigate = useNavigate();
  const settings = useSettings();
  const [chosenFormat, setChosenFormat] = useState<CopyFormat | null>(null);
  const [busy, setBusy] = useState(false);
  // Undefined until the settings are loaded: the choice is not shown before that, so "Text" is
  // never briefly selected in place of the stored default.
  const shownFormat = chosenFormat ?? settings?.copyFormat;
  const format = shownFormat ?? 'text';

  const run = async (action: 'copy' | 'share') => {
    const errors = validateAnswers(form, answers, t);
    if (errors.size > 0) {
      onInvalid(errors);
      notifications.show({ color: 'red', message: t('fill.missing') });
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    try {
      const saved = flush();
      const labels = { yes: t('fill.yes'), no: t('fill.no') };
      let result: 'copied' | 'shared' | 'cancelled' | 'fallback' | 'failed';
      if (action === 'copy') {
        const text = formatEntry(form, answers, format === 'html' ? 'text' : format, lang, labels);
        const html =
          format === 'html' ? formatEntry(form, answers, 'html', lang, labels) : undefined;
        result = await copyToClipboard({ text, html });
      } else {
        result = await shareText(formatEntry(form, answers, 'whatsapp', lang, labels));
      }
      if (result === 'cancelled') return;
      if (result === 'failed') {
        notifications.show({
          color: 'red',
          message: t(action === 'copy' ? 'fill.copyFailed' : 'fill.shareFailed'),
        });
        return;
      }
      if (result === 'copied') notifications.show({ color: 'green', message: t('fill.copied') });

      try {
        await saved;
      } catch {
        // Answers are not safely stored: never mark shared or delete in that state.
        notifications.show({ color: 'red', message: t('fill.saveFailed') });
        return;
      }
      const fresh = await getEntry(entryId);
      if (!fresh) {
        // Removed meanwhile (e.g. in another tab) and nothing was left to save that would have
        // put it back: say so instead of doing nothing.
        notifications.show({ color: 'red', message: t('fill.entryGone') });
        return;
      }
      const setting = (settings ?? (await getSettings())).deleteAfterShare;
      const outcome = await afterSuccessfulShare(fresh, setting, new Date());
      if (outcome.deleted && outcome.undo) {
        showUndo(outcome.undo);
        await navigate('/entries');
      }
    } catch (error) {
      console.error('Copy/share failed', error);
      notifications.show({ color: 'red', message: t('fill.saveFailed') });
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };

  const showUndo = (undo: () => Promise<void>) => {
    const id = notifications.show({
      autoClose: 5000,
      message: (
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm">{t('fill.deleted')}</Text>
          <Button
            size="compact-sm"
            variant="light"
            onClick={() => {
              notifications.hide(id);
              undo().then(
                () => notifications.show({ color: 'green', message: t('fill.restored') }),
                (error: unknown) => {
                  console.error('Undo failed', error);
                  notifications.show({ color: 'red', message: t('fill.saveFailed') });
                },
              );
            }}
          >
            {t('fill.undo')}
          </Button>
        </Group>
      ),
    });
  };

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500} id="fill-format-label">
        {t('fill.format')}
      </Text>
      {shownFormat ? (
        <SegmentedControl
          aria-labelledby="fill-format-label"
          value={shownFormat}
          onChange={(v) => setChosenFormat(v as CopyFormat)}
          data={FORMATS.map((f) => ({ value: f, label: t(`settings.copyFormat.${f}`) }))}
        />
      ) : (
        <Skeleton height={36} radius="sm" data-testid="fill-format-loading" />
      )}
      <Group grow>
        <Button variant="default" loading={busy} onClick={() => void run('copy')}>
          {t('fill.copy')}
        </Button>
        <Button loading={busy} onClick={() => void run('share')}>
          {t('fill.share')}
        </Button>
      </Group>
    </Stack>
  );
}
