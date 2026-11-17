import { Button, Group, Modal, Text } from '@mantine/core';
import { useT } from '../../i18n/I18nProvider';
import type { Form } from '../../schema/form';

export type ConflictAction = 'replace' | 'copy' | 'skip';

/** Lazy chunk (keeps Modal out of the first load). One modal per import conflict; closing it counts as "skip". */
export function ImportConflictModal(props: {
  form: Form;
  onResolve: (action: ConflictAction) => void;
}) {
  const t = useT();
  const { form, onResolve } = props;
  return (
    <Modal
      opened
      onClose={() => onResolve('skip')}
      title={t('forms.conflict.title')}
      closeOnClickOutside={false}
    >
      <Text>{t('forms.conflict.text', { title: form.title || t('forms.untitled') })}</Text>
      <Group mt="md" justify="flex-end">
        <Button variant="default" onClick={() => onResolve('skip')}>
          {t('forms.conflict.skip')}
        </Button>
        <Button variant="default" onClick={() => onResolve('copy')}>
          {t('forms.conflict.copy')}
        </Button>
        <Button color="red" onClick={() => onResolve('replace')}>
          {t('forms.conflict.replace')}
        </Button>
      </Group>
    </Modal>
  );
}
