import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { LIBRARY_ENABLED } from '../config/features';
import { db } from '../db/db';
import { renderApp } from '../test/renderApp';
import { mockViewport } from '../test/viewport';

// No mock: the shipped switch value. Library-on behaviour is covered in AppLayout.test.tsx.
beforeEach(async () => {
  await db.settings.clear();
  mockViewport('desktop');
});

describe('library hidden (LIBRARY_ENABLED = false)', () => {
  it('ships with the switch off', () => {
    expect(LIBRARY_ENABLED).toBe(false);
  });

  it('offers four menu items, without Bibliothek', async () => {
    renderApp();
    for (const name of ['Meine Formulare', 'Meine Einträge', 'Einstellungen', 'Über']) {
      expect(await screen.findByRole('link', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: 'Bibliothek' })).not.toBeInTheDocument();
  });

  it('redirects /library to /forms', async () => {
    renderApp('/library');
    expect(await screen.findByRole('heading', { name: 'Meine Formulare' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bibliothek' })).not.toBeInTheDocument();
  });
});
