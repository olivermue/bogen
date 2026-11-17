import { Button, Group, Modal, Text } from '@mantine/core';
import { useT } from '../../i18n/I18nProvider';

/** Confirmation before an entry is deleted. Lazy chunk: keeps Modal out of the first load. */
export function DeleteEntryModal(props: {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  return (
    <Modal opened onClose={props.onCancel} title={t('entries.delete.title')}>
      <Text>{t('entries.delete.text', { title: props.title })}</Text>
      <Group mt="md" justify="flex-end">
        <Button variant="default" onClick={props.onCancel}>
          {t('forms.cancel')}
        </Button>
        <Button color="red" onClick={props.onConfirm}>
          {t('forms.delete')}
        </Button>
      </Group>
    </Modal>
  );
}
