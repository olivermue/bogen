import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../AppProviders';
import { db } from '../../db/db';
import { saveSettings } from '../../db/settings';
import { de } from '../../i18n/de';
import type { Form } from '../../schema/form';
import { OutputActions } from './OutputActions';

const form: Form = {
  id: 'f',
  title: 'Bogen',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
  fields: [],
};

function renderActions() {
  const router = createMemoryRouter([
    {
      path: '/',
      element: (
        <OutputActions
          entryId="e"
          form={form}
          answers={{}}
          flush={() => Promise.resolve()}
          onInvalid={() => {}}
        />
      ),
    },
  ]);
  render(
    <AppProviders language="de" messages={de}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

beforeEach(async () => {
  await db.settings.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OutputActions format choice', () => {
  it('is not shown (no "Text" preselected) until the settings are loaded', async () => {
    vi.spyOn(db.settings, 'get').mockReturnValue(
      new Promise(() => {}) as ReturnType<typeof db.settings.get>,
    );
    renderActions();
    expect(await screen.findByTestId('fill-format-loading')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('shows the stored default format once the settings are loaded', async () => {
    await saveSettings({ copyFormat: 'markdown' });
    renderActions();
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Markdown' })).toBeChecked());
    expect(screen.queryByTestId('fill-format-loading')).not.toBeInTheDocument();
  });
});
