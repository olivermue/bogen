import { ActionIcon } from '@mantine/core';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';

/**
 * The "⋯" trigger of a form card. First-load code: it is the placeholder while the
 * lazy menu chunk (FormCardMenu) loads, and that menu's target afterwards.
 */
export const MoreButton = forwardRef<
  HTMLButtonElement,
  { label: string } & Omit<ComponentPropsWithoutRef<'button'>, 'aria-label' | 'color'>
>(function MoreButton({ label, ...rest }, ref) {
  return (
    <ActionIcon ref={ref} variant="subtle" size="xl" aria-label={label} {...rest}>
      <span aria-hidden>⋯</span>
    </ActionIcon>
  );
});
