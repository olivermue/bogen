import { Button } from '@mantine/core';
import { useT } from '../../../i18n/I18nProvider';

/** Removes the answer of a radio-style field (radios cannot be unselected otherwise). */
export function ClearButton(props: { onClick: () => void }) {
  const t = useT();
  return (
    <Button variant="subtle" size="compact-xs" onClick={props.onClick}>
      {t('fill.clear')}
    </Button>
  );
}
