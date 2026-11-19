import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/db';
import { renderApp } from '../../test/renderApp';
import { mockViewport } from '../../test/viewport';

// Holds the lazy menu chunk back until the test releases it.
const gate = vi.hoisted(() => {
  let release = () => {};
  const ready = new Promise<void>((resolve) => (release = resolve));
  return { ready, release: () => release() };
});
vi.mock('./FormCardMenu', async (importOriginal) => {
  await gate.ready;
  return importOriginal();
});

beforeEach(async () => {
  await db.forms.clear();
  mockViewport('desktop');
});

describe('FormCardMenu (lazy)', () => {
  it('opens the menu once loaded when "⋯" was tapped before', async () => {
    await db.forms.put({
      id: 'a',
      title: 'Bogen',
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
      fields: [],
    });
    renderApp('/forms');
    // Placeholder: same button, no menu yet.
    await userEvent.click(
      await screen.findByRole('button', { name: 'Weitere Aktionen für „Bogen“' }),
    );
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();

    await act(async () => gate.release());
    expect(await screen.findByRole('menuitem', { name: 'Als Link teilen' })).toBeVisible();
  });
});
