import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, type Entry } from '../../db/db';
import { saveSettings, type DeleteAfterShare } from '../../db/settings';
import type { Form } from '../../schema/form';
import { renderApp } from '../../test/renderApp';
import { mockViewport } from '../../test/viewport';

const form: Form = {
  id: 'f',
  title: 'Mein Bogen',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
  fields: [{ id: 'a', type: 'textLine', label: 'Name', required: true, options: {} }],
};

const entry = (id: string, over: Partial<Entry> = {}): Entry => ({
  id,
  formId: 'f',
  formSource: 'own',
  formSnapshot: form,
  answers: {},
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
  sharedAt: null,
  ...over,
});

const HOUR = 3600_000;
const SHARED_AT = new Date(2026, 10, 15, 10, 0);
const heading = () => screen.queryByRole('heading', { name: 'Mein Bogen' });

beforeEach(async () => {
  await db.entries.clear();
  await db.settings.clear();
  mockViewport('desktop');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('EntriesPage', () => {
  it('shows a loader instead of an empty area while the list loads', async () => {
    const pending = new Promise<Entry[]>(() => {});
    vi.spyOn(db.entries, 'orderBy').mockReturnValue({
      reverse: () => ({ toArray: () => pending }),
    } as unknown as ReturnType<typeof db.entries.orderBy>);
    renderApp('/entries');
    // Announced: the live region has the text as content, not only as aria-label.
    expect(await screen.findByRole('status', { name: 'Wird geladen …' })).toHaveTextContent(
      'Wird geladen …',
    );
    expect(screen.queryByText(/Noch keine Einträge/)).not.toBeInTheDocument();
  });

  it('shows an empty state linking to the forms', async () => {
    renderApp('/entries');
    expect(await screen.findByText(/Noch keine Einträge/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zu meinen Formularen' })).toHaveAttribute(
      'href',
      expect.stringContaining('/forms'),
    );
  });

  it('marks an entry complete only without missing required fields', async () => {
    await db.entries.bulkPut([
      entry('open'),
      entry('done', { answers: { a: 'Ada' }, updatedAt: '2026-01-02T10:00:00.000Z' }),
    ]);
    renderApp('/entries');
    expect(await screen.findAllByRole('heading', { name: 'Mein Bogen' })).toHaveLength(2);
    expect(screen.getAllByText('vollständig')).toHaveLength(1);
    expect(screen.getAllByText('angefangen')).toHaveLength(1);
    for (const h of screen.getAllByRole('heading', { name: 'Mein Bogen' })) {
      expect(h.closest('.mantine-Card-root')).toHaveClass('bogen-list-card');
    }
  });

  it('shows the share time and a local last-change timestamp', async () => {
    await db.entries.put(
      entry('s', {
        updatedAt: new Date(2026, 0, 2, 14, 5).toISOString(),
        sharedAt: new Date(2026, 0, 3, 9, 7).toISOString(),
      }),
    );
    renderApp('/entries');
    expect(await screen.findByText('Zuletzt geändert: 02.01.2026 14:05')).toBeInTheDocument();
    expect(screen.getByText('Geteilt am 03.01.2026 09:07')).toBeInTheDocument();
  });

  it('opens an entry', async () => {
    await db.entries.put(entry('x'));
    renderApp('/entries');
    await userEvent.click(await screen.findByRole('button', { name: 'Öffnen' }));
    expect(await screen.findByText('Name')).toBeInTheDocument();
  });

  it('asks before deleting and keeps the entry on cancel', async () => {
    await db.entries.put(entry('x'));
    renderApp('/entries');
    await userEvent.click(await screen.findByRole('button', { name: 'Löschen' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Abbrechen' }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await db.entries.count()).toBe(1);

    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Löschen' }),
    );
    await waitFor(async () => expect(await db.entries.count()).toBe(0));
    expect(await screen.findByText(/Noch keine Einträge/)).toBeInTheDocument();
  });

  describe('cleanup on visibilitychange', () => {
    // Mounts 1 h before the entry becomes due-or-not, then moves the clock and
    // fires visibilitychange.
    const run = async (setting: DeleteAfterShare, elapsedHours: number) => {
      await saveSettings({ deleteAfterShare: setting });
      await db.entries.put(entry('s', { sharedAt: SHARED_AT.toISOString() }));
      vi.useFakeTimers({ toFake: ['Date'], now: new Date(SHARED_AT.getTime() + 1 * HOUR) });
      renderApp('/entries');
      expect(await screen.findByRole('heading', { name: 'Mein Bogen' })).toBeInTheDocument();
      vi.setSystemTime(new Date(SHARED_AT.getTime() + elapsedHours * HOUR));
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
    };

    it('removes an entry shared 25 h ago with setting 1d', async () => {
      await run('1d', 25);
      await waitFor(() => expect(heading()).toBeNull());
      expect(await db.entries.count()).toBe(0);
    });

    it('keeps an entry shared 23 h ago with setting 1d', async () => {
      await run('1d', 23);
      // Let any (unwanted) deletion propagate before asserting.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });
      expect(await db.entries.count()).toBe(1);
      expect(heading()).toBeInTheDocument();
    });
  });
});
