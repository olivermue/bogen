import {
  AppShell,
  Burger,
  Group,
  NavLink,
  Text,
  Title,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useMatches } from 'react-router';
import { LIBRARY_ENABLED } from '../config/features';
import { saveSettings, useSettings } from '../db/settings';
import type { MessageKey } from '../i18n/de';
import { useT } from '../i18n/I18nProvider';
import { UpdateIndicator } from '../pwa/UpdateIndicator';
import type { RouteHandle } from '../router';

const MENU: { to: string; labelKey: MessageKey }[] = [
  { to: '/forms', labelKey: 'nav.forms' },
  ...(LIBRARY_ENABLED ? [{ to: '/library', labelKey: 'nav.library' } as const] : []),
  { to: '/entries', labelKey: 'nav.entries' },
  { to: '/settings', labelKey: 'nav.settings' },
  { to: '/about', labelKey: 'nav.about' },
];

export function AppLayout() {
  const t = useT();
  const theme = useMantineTheme();
  const settings = useSettings();
  const { setColorScheme } = useMantineColorScheme();
  const { pathname } = useLocation();
  const matches = useMatches();
  const isDesktop = useMediaQuery(`(min-width: ${theme.breakpoints.sm})`, true) ?? true;
  const [mobileOpen, setMobileOpen] = useState(false);

  // Colour scheme comes from the persisted settings (R1: no localStorage).
  const scheme = settings?.colorScheme;
  useEffect(() => {
    if (scheme) setColorScheme(scheme);
  }, [scheme, setColorScheme]);

  const handle = matches.at(-1)?.handle as RouteHandle | undefined;
  // Browser tab / history title per route, in the current language.
  const pageTitle = handle ? t('app.documentTitle', { page: t(handle.titleKey) }) : t('app.title');
  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  if (!settings) return null;

  const desktopOpen = settings.navbarDesktopOpen;
  const open = isDesktop ? desktopOpen : mobileOpen;

  const toggle = () => {
    if (isDesktop) void saveSettings({ navbarDesktopOpen: !desktopOpen });
    else setMobileOpen((o) => !o);
  };

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpen, desktop: !desktopOpen },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" gap="sm" wrap="nowrap">
          {/* Always the hamburger icon (opened stays false); aria-expanded carries the state. */}
          <Burger
            opened={false}
            aria-expanded={open}
            onClick={toggle}
            size="sm"
            color="white"
            aria-label={t('nav.toggle')}
            style={{ flexShrink: 0 }}
          />
          <Group gap={8} wrap="nowrap" ml={8} style={{ flexShrink: 0 }}>
            {/* Decorative: the acronym next to it already names the app. */}
            {/* The sheet from logo-small.svg without its petrol tile, so it sits on the header in both schemes. */}
            <svg
              viewBox="136 88 240 336"
              width={18}
              height={25}
              aria-hidden="true"
              focusable="false"
              style={{ display: 'block' }}
            >
              <rect x="136" y="88" width="240" height="336" rx="28" fill="#ffffff" />
              <rect x="172" y="126" width="120" height="28" rx="14" fill="#2e86a8" />
              <rect x="172" y="176" width="168" height="24" rx="12" fill="#3f93b4" />
              <rect x="172" y="218" width="168" height="24" rx="12" fill="#3f93b4" />
              <path
                d="M182 336 L226 380 L330 280"
                fill="none"
                stroke="#0b5f7c"
                strokeWidth="36"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <Text fw={700}>{t('app.title')}</Text>
          </Group>
          {/* The page title gives way (truncated) so the update indicator always stays visible. */}
          {handle ? (
            <Title
              order={1}
              size="h4"
              fw={500}
              miw={0}
              style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {t(handle.titleKey)}
            </Title>
          ) : null}
          <UpdateIndicator />
        </Group>
      </AppShell.Header>
      {/* Collapsed navbar is only moved off-screen by CSS: hide it from AT and focus too. */}
      <AppShell.Navbar p="xs" aria-hidden={!open} inert={!open}>
        {MENU.map((item) => (
          <NavLink
            key={item.to}
            component={Link}
            to={item.to}
            label={t(item.labelKey)}
            active={pathname === item.to || pathname.startsWith(`${item.to}/`)}
            onClick={() => setMobileOpen(false)}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
