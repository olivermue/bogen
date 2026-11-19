import { Menu } from '@mantine/core';
import { useT } from '../../i18n/I18nProvider';
import { MoreButton } from './MoreButton';

export type FormCardAction = 'shareLink' | 'duplicate' | 'exportFile' | 'delete';

/**
 * Lazy chunk: Menu with Popover and floating-ui stays out of the first load.
 * `defaultOpened`: the placeholder was tapped before this chunk arrived.
 */
export function FormCardMenu(props: {
  label: string;
  defaultOpened: boolean;
  onAction: (action: FormCardAction) => void;
}) {
  const t = useT();
  const { onAction } = props;
  return (
    // hideDetached off: floating-ui's hide middleware wrongly hides the menu in jsdom (all rects are 0).
    <Menu
      position="bottom-end"
      withinPortal
      hideDetached={false}
      defaultOpened={props.defaultOpened}
    >
      <Menu.Target>
        <MoreButton label={props.label} />
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={() => onAction('shareLink')}>{t('forms.shareLink')}</Menu.Item>
        <Menu.Item onClick={() => onAction('duplicate')}>{t('forms.duplicate')}</Menu.Item>
        <Menu.Item onClick={() => onAction('exportFile')}>{t('forms.exportFile')}</Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red" onClick={() => onAction('delete')}>
          {t('forms.delete')}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
