import { Group, Loader, VisuallyHidden } from '@mantine/core';
import { useT } from '../i18n/I18nProvider';

/**
 * Placeholder while a list is loading for the first time (instead of an empty area). The live
 * region carries the text as content (visually hidden), so screen readers announce it; the
 * spinner itself is decorative.
 */
export function PageLoader() {
  const t = useT();
  const text = t('common.loading');
  return (
    <Group justify="center" py="xl" role="status" aria-label={text}>
      <Loader aria-hidden />
      <VisuallyHidden>{text}</VisuallyHidden>
    </Group>
  );
}
