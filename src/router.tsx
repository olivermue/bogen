import { Navigate, createHashRouter, type RouteObject } from 'react-router';
import { LIBRARY_ENABLED } from './config/features';
import { AboutPage } from './features/about/AboutPage';
import { EntriesPage } from './features/entries/EntriesPage';
import { FillPage } from './features/fill/FillPage';
import { FormsPage } from './features/forms/FormsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import type { MessageKey } from './i18n/de';
import { AppLayout } from './layout/AppLayout';
import { RouteErrorView } from './pwa/RouteErrorView';

export interface RouteHandle {
  titleKey: MessageKey;
}

// Builder and library are lazy: their chunks (dnd-kit etc.) stay out of the first load.
const lazyBuilder = async () => ({
  Component: (await import('./features/builder/BuilderPage')).BuilderPage,
});

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    // Chunk load errors (lazy routes after a release) and other errors: reload once / reset.
    errorElement: <RouteErrorView />,
    children: [
      { path: '/', element: <Navigate to="/forms" replace /> },
      { path: '/forms', element: <FormsPage />, handle: { titleKey: 'nav.forms' } },
      { path: '/forms/new', lazy: lazyBuilder, handle: { titleKey: 'page.builder' } },
      { path: '/forms/:formId/edit', lazy: lazyBuilder, handle: { titleKey: 'page.builder' } },
      // LIBRARY_ENABLED (first operand) is the runtime switch tests can mock; only __LIBRARY_BUNDLED__ lets the bundler prune.
      // __LIBRARY_BUNDLED__ is a build-time literal (vite.config.ts, from LIBRARY_ENABLED): Rolldown only prunes
      // the dynamic import (and with it the library chunk and JSON) when the condition is a literal.
      LIBRARY_ENABLED && __LIBRARY_BUNDLED__
        ? {
            path: '/library',
            lazy: async () => ({
              Component: (await import('./features/library/LibraryPage')).LibraryPage,
            }),
            handle: { titleKey: 'nav.library' },
          }
        : { path: '/library', element: <Navigate to="/forms" replace /> },
      { path: '/entries', element: <EntriesPage />, handle: { titleKey: 'nav.entries' } },
      { path: '/entries/:entryId', element: <FillPage />, handle: { titleKey: 'page.fill' } },
      { path: '/settings', element: <SettingsPage />, handle: { titleKey: 'nav.settings' } },
      { path: '/about', element: <AboutPage />, handle: { titleKey: 'nav.about' } },
      { path: '*', element: <Navigate to="/forms" replace /> },
    ],
  },
];

export function createAppRouter() {
  return createHashRouter(routes);
}
