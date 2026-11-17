import { Button, Group, Modal, Text } from '@mantine/core';
import { useT } from '../../i18n/I18nProvider';
import type { Form } from '../../schema/form';

/** Confirmation before a form is deleted. Lazy chunk: keeps Modal out of the first load. */
export function DeleteFormModal(props: {
  form: Form;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  const { form, onCancel, onConfirm } = props;
  return (
    <Modal opened onClose={onCancel} title={t('forms.delete.title')}>
      <Text>{t('forms.delete.text', { title: form.title || t('forms.untitled') })}</Text>
      <Group mt="md" justify="flex-end">
        <Button variant="default" onClick={onCancel}>
          {t('forms.cancel')}
        </Button>
        <Button color="red" onClick={onConfirm}>
          {t('forms.delete')}
        </Button>
      </Group>
    </Modal>
  );
}
