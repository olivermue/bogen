import { MantineProvider, type MantineColorScheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { useState, type ReactNode } from 'react';
import { createMemoryColorSchemeManager } from './colorSchemeManager';
import { I18nProvider } from './i18n/I18nProvider';
import type { Language, Messages } from './i18n/detect';
import './mantineStyles';
import { cssVariablesResolver, theme } from './theme';
import '@mantine/notifications/styles.css';

export function AppProviders(props: {
  language: Language;
  messages: Messages;
  /** Initial colour scheme (from the settings read at boot); later changes come via AppLayout. */
  colorScheme?: MantineColorScheme;
  children: ReactNode;
}) {
  const initialScheme = props.colorScheme ?? 'auto';
  const [colorSchemeManager] = useState(() => createMemoryColorSchemeManager(initialScheme));
  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      colorSchemeManager={colorSchemeManager}
      defaultColorScheme={initialScheme}
    >
      <I18nProvider language={props.language} messages={props.messages}>
        {/* Mantine 8 behaviour: hovering pauses only the hovered notification (9.x default: all). */}
        <Notifications pauseResetOnHover="notification" />
        {props.children}
      </I18nProvider>
    </MantineProvider>
  );
}
