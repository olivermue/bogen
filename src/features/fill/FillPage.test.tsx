import { notifications } from '@mantine/notifications';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, type Entry } from '../../db/db';
import { createEntry, getEntry, markShared, updateAnswers } from '../../db/entries';
import { saveForm } from '../../db/forms';
import { saveSettings, type DeleteAfterShare } from '../../db/settings';
import type { Answers, Field, Form } from '../../schema/form';
import { runCleanup } from '../../domain/cleanup';
import { flushAllPendingWrites } from '../../pwa/pendingWrites';
import { renderApp } from '../../test/renderApp';

// Mutable switch (default on = behaviour with the library); one test switches it off.
const features = vi.hoisted(() => ({ library: true }));
vi.mock('../../config/features', () => ({
  get LIBRARY_ENABLED() {
    return features.library;
  },
}));

const NOW = '2026-01-01T00:00:00.000Z';

function form(fields: Field[], overrides: Partial<Form> = {}): Form {
  return { id: 'form-1', title: 'Bogen', createdAt: NOW, updatedAt: NOW, fields, ...overrides };
}

const name: Field = { id: 'name', type: 'textLine', label: 'Name', required: false, options: {} };
const requiredName: Field = { ...name, required: true };
const color: Field = {
  id: 'color',
  type: 'singleChoice',
  label: 'Farbe',
  required: false,
  options: {
    display: 'radio',
    choices: [
      { id: 'red', label: 'Rot' },
      { id: 'blue', label: 'Blau' },
    ],
  },
};
const note: Field = { id: 'note', type: 'textLine', label: 'Notiz', required: false, options: {} };

async function seed(f: Form, answers?: Answers): Promise<Entry> {
  await saveForm(f);
  const entry = await createEntry(f, 'own');
  if (answers) await updateAnswers(entry.id, answers);
  return entry;
}

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}
function setShare(value: unknown) {
  Object.defineProperty(navigator, 'share', { value, configurable: true, writable: true });
}
function stubClipboard() {
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
  setClipboard({ writeText });
  return writeText;
}

async function setDeleteAfterShare(value: DeleteAfterShare) {
  await saveSettings({ deleteAfterShare: value });
}

beforeEach(async () => {
  await db.forms.clear();
  await db.entries.clear();
  await db.settings.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setClipboard(undefined);
  setShare(undefined);
  notifications.clean();
});

describe('FillPage', () => {
  it('shows a not-found message with a link to the entries', async () => {
    renderApp('/entries/nope');
    expect(await screen.findByText('Eintrag nicht gefunden.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zu meinen Einträgen' })).toHaveAttribute(
      'href',
      '/entries',
    );
  });

  // Review Focus 1 (page level): the strict synchronous check lives in useAutosave.test.ts.
  // The pagehide/visibilitychange/beforeunload flush itself is covered in useAutosave.test.ts.
  it('stores each typed change right away (no debounce)', async () => {
    const entry = await seed(form([name]));
    renderApp(`/entries/${entry.id}`);
    await userEvent.type(await screen.findByLabelText('Name'), 'Bo');
    await flushAllPendingWrites();
    expect((await getEntry(entry.id))?.answers).toEqual({ name: 'Bo' });
  });

  it('keeps an open entry through cleanup and stores answers typed afterwards', async () => {
    await setDeleteAfterShare('1d');
    const entry = await seed(form([name]), { name: 'A' });
    await markShared(entry.id, new Date()); // not yet due when the app starts
    renderApp(`/entries/${entry.id}`);
    const input = await screen.findByLabelText('Name');
    // Two days later the tab becomes visible again (useCleanupOnActive): the entry is due, but
    // it is open here, so it is not deleted.
    expect(await runCleanup(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000))).toBe(0);
    await userEvent.type(input, 'nna');
    await flushAllPendingWrites();
    const stored = await getEntry(entry.id);
    expect(stored?.answers).toEqual({ name: 'Anna' });
    expect(stored?.sharedAt).toBeNull();
  });

  it('puts the entry back with the typed answers if it was deleted elsewhere meanwhile', async () => {
    const entry = await seed(form([name]), { name: 'A' });
    renderApp(`/entries/${entry.id}`);
    const input = await screen.findByLabelText('Name');
    await db.entries.delete(entry.id); // e.g. cleanup in another tab
    await userEvent.type(input, 'nna');
    await flushAllPendingWrites();
    const stored = await getEntry(entry.id);
    expect(stored?.answers).toEqual({ name: 'Anna' });
    expect(stored?.formSnapshot).toEqual(entry.formSnapshot);
    expect(stored?.sharedAt).toBeNull();
    expect(await screen.findByText(/wurde mit den Antworten auf dieser Seite/)).toBeInTheDocument();
  });

  it('copy on an entry that vanished (nothing left to save) shows an error', async () => {
    const writeText = stubClipboard();
    const entry = await seed(form([name]), { name: 'Anna' });
    renderApp(`/entries/${entry.id}`);
    await screen.findByLabelText('Name');
    await db.entries.delete(entry.id);
    await userEvent.click(screen.getByRole('button', { name: 'Kopieren' }));
    expect(await screen.findByText(/existiert nicht mehr/)).toBeInTheDocument();
    expect(writeText).toHaveBeenCalled();
    expect(await getEntry(entry.id)).toBeUndefined();
  });

  it('warns once while autosave fails and clears the warning after a successful write', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const entry = await seed(form([name]));
    renderApp(`/entries/${entry.id}`);
    const input = await screen.findByLabelText('Name');
    const where = vi.spyOn(db.entries, 'where').mockImplementation(() => {
      throw new Error('quota');
    });
    await userEvent.type(input, 'Ann');
    await waitFor(() => expect(screen.getAllByText(/gerade nicht gespeichert/)).toHaveLength(1));
    where.mockRestore();
    await userEvent.type(input, 'a');
    await flushAllPendingWrites();
    expect((await getEntry(entry.id))?.answers).toEqual({ name: 'Anna' });
    await waitFor(() => expect(screen.queryByText(/gerade nicht gespeichert/)).toBeNull());
  });

  // Review Focus 2
  it('renders snapshot after source form was edited', async () => {
    const original = form([name, color, note]);
    const entry = await seed(original, { name: 'Anna', color: 'blue', note: 'Alte Notiz' });
    // Edit the source form: delete a field and remove the chosen option.
    await saveForm({
      ...original,
      fields: [
        name,
        { ...color, options: { ...color.options, choices: [{ id: 'red', label: 'Rot' }] } },
      ],
    });
    const writeText = stubClipboard();
    renderApp(`/entries/${entry.id}`);
    expect(await screen.findByLabelText('Notiz')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Blau' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Kopieren' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0]?.[0]).toContain('Farbe: Blau');
    expect(writeText.mock.calls[0]?.[0]).toContain('Notiz: Alte Notiz');
  });

  it('blocks copy when required fields are missing and marks them', async () => {
    const entry = await seed(form([note, requiredName]));
    const writeText = stubClipboard();
    renderApp(`/entries/${entry.id}`);
    const input = await screen.findByLabelText(/Name/);
    await userEvent.click(screen.getByRole('button', { name: 'Kopieren' }));
    expect(await screen.findByText('Bitte ausfüllen.')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveFocus();
    expect(screen.getByLabelText('Notiz')).not.toHaveAttribute('aria-invalid', 'true');
    expect(writeText).not.toHaveBeenCalled();
    expect((await getEntry(entry.id))?.sharedAt).toBeNull();
    // Answering clears the mark.
    await userEvent.type(input, 'A');
    expect(screen.queryByText('Bitte ausfüllen.')).not.toBeInTheDocument();
  });

  it('blocks copy when fewer than minSelected options are chosen', async () => {
    const multi: Field = {
      id: 'm',
      type: 'multipleChoice',
      label: 'Extras',
      required: false,
      options: {
        choices: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C' },
        ],
        minSelected: 2,
        maxSelected: 2,
      },
    };
    const entry = await seed(form([multi]));
    const writeText = stubClipboard();
    renderApp(`/entries/${entry.id}`);
    await userEvent.click(await screen.findByRole('checkbox', { name: 'A' }));
    await userEvent.click(screen.getByRole('button', { name: 'Kopieren' }));
    expect(await screen.findByText('Bitte mindestens 2 auswählen.')).toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'B' }));
    // maxSelected reached: the remaining option is disabled.
    expect(screen.getByRole('checkbox', { name: 'C' })).toBeDisabled();
  });

  describe('chips display', () => {
    const choices = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ];

    it('single choice chips store the option id and can be cleared', async () => {
      const f: Field = {
        id: 's',
        type: 'singleChoice',
        label: 'Wahl',
        required: false,
        options: { display: 'chips', choices },
      };
      const entry = await seed(form([f]));
      renderApp(`/entries/${entry.id}`);
      await userEvent.click(await screen.findByRole('radio', { name: 'B' }));
      expect(document.querySelector('.mantine-Chip-root')).not.toBeNull();
      await waitFor(async () => expect((await getEntry(entry.id))?.answers).toEqual({ s: 'b' }));
      expect(screen.getByRole('radio', { name: 'B' })).toBeChecked();
      await userEvent.click(screen.getByRole('button', { name: 'Auswahl entfernen' }));
      await waitFor(async () => expect((await getEntry(entry.id))?.answers.s ?? null).toBeNull());
    });

    it('multiple choice chips store ids in option order and enforce maxSelected', async () => {
      const f: Field = {
        id: 'm',
        type: 'multipleChoice',
        label: 'Extras',
        required: false,
        options: { display: 'chips', choices, maxSelected: 2 },
      };
      const entry = await seed(form([f]));
      renderApp(`/entries/${entry.id}`);
      await userEvent.click(await screen.findByRole('checkbox', { name: 'C' }));
      await userEvent.click(screen.getByRole('checkbox', { name: 'A' }));
      await waitFor(async () =>
        expect((await getEntry(entry.id))?.answers).toEqual({ m: ['a', 'c'] }),
      );
      expect(screen.getByRole('checkbox', { name: 'B' })).toBeDisabled();
      expect(document.querySelector('.mantine-Chip-root')).not.toBeNull();
    });

    it('marks a missing required chips answer', async () => {
      const f: Field = {
        id: 's',
        type: 'singleChoice',
        label: 'Wahl',
        required: true,
        options: { display: 'chips', choices },
      };
      const entry = await seed(form([f]));
      stubClipboard();
      renderApp(`/entries/${entry.id}`);
      await screen.findByRole('radio', { name: 'A' });
      await userEvent.click(screen.getByRole('button', { name: 'Kopieren' }));
      expect(await screen.findByText('Bitte ausfüllen.')).toBeInTheDocument();
    });
  });

  // Review Focus 5
  it('date field near midnight stores local date', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 1, 0, 30) });
    const date: Field = {
      id: 'd',
      type: 'date',
      label: 'Datum',
      required: false,
      options: { defaultToday: true },
    };
    const entry = await seed(form([date]));
    const writeText = stubClipboard();
    renderApp(`/entries/${entry.id}`);
    expect(await screen.findByRole('button', { name: 'Datum' })).toHaveTextContent('01.11.2026');
    await waitFor(async () =>
      expect((await getEntry(entry.id))?.answers).toEqual({ d: '2026-11-01' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Kopieren' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0]?.[0]).toContain('Datum: 01.11.2026');
  });

  it('does not prefill today when reopening an existing (shared) entry', async () => {
    const date: Field = {
      id: 'd',
      type: 'date',
      label: 'Datum',
      required: false,
      options: { defaultToday: true },
    };
    const entry = await seed(form([name, date]), { name: 'Anna' });
    await markShared(entry.id, new Date(2026, 9, 1));
    const before = await getEntry(entry.id);
    renderApp(`/entries/${entry.id}`);
    const picker = await screen.findByRole('button', { name: 'Datum' });
    expect(picker).not.toHaveTextContent(/\d/);
    // Any write the page had started (autosave or a leave-flush) would be awaited here.
    window.dispatchEvent(new Event('pagehide'));
    await flushAllPendingWrites();
    expect(await getEntry(entry.id)).toEqual(before);
  });

  it('disables the fields while sharing so no late edit is lost', async () => {
    await setDeleteAfterShare('immediately');
    let finishShare: () => void = () => {};
    setShare(vi.fn(() => new Promise<void>((r) => (finishShare = r))));
    const entry = await seed(form([name]), { name: 'Anna' });
    renderApp(`/entries/${entry.id}`);
    const input = await screen.findByLabelText('Name');
    await userEvent.click(screen.getByRole('button', { name: 'Teilen' }));
    await waitFor(() => expect(input).toBeDisabled());
    finishShare();
    await waitFor(async () => expect(await getEntry(entry.id)).toBeUndefined());
  });

  // Review Focus 4
  it('cancelled share keeps entry with setting immediately', async () => {
    await setDeleteAfterShare('immediately');
    const share = vi.fn().mockRejectedValue(new DOMException('x', 'AbortError'));
    setShare(share);
    const entry = await seed(form([name]));
    renderApp(`/entries/${entry.id}`);
    await userEvent.type(await screen.findByLabelText('Name'), 'Anna');
    await userEvent.click(screen.getByRole('button', { name: 'Teilen' }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    // WhatsApp format for sharing (R3).
    expect(share.mock.calls[0]?.[0]).toEqual({ text: '*Bogen*\n\n*Name*: Anna' });
    const stored = await getEntry(entry.id);
    expect(stored?.sharedAt).toBeNull();
    expect(stored?.answers).toEqual({ name: 'Anna' });
    expect(screen.getByLabelText('Name')).toBeInTheDocument(); // still on the page
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).not.toBeInTheDocument();
  });

  it('failed share shows an error and keeps the entry unshared', async () => {
    await setDeleteAfterShare('immediately');
    setShare(undefined);
    vi.spyOn(window, 'open').mockReturnValue(null); // popup blocked
    const entry = await seed(form([name]), { name: 'Anna' });
    renderApp(`/entries/${entry.id}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Teilen' }));
    expect(await screen.findByText(/Teilen fehlgeschlagen/)).toBeInTheDocument();
    expect((await getEntry(entry.id))?.sharedAt).toBeNull();
  });

  it('copy with setting immediately deletes entry and offers undo', async () => {
    await setDeleteAfterShare('immediately');
    const writeText = stubClipboard();
    const entry = await seed(form([name]));
    renderApp(`/entries/${entry.id}`);
    await userEvent.type(await screen.findByLabelText('Name'), 'Anna');
    // Click right away: the pending autosave must be flushed before deleting.
    await userEvent.click(screen.getByRole('button', { name: 'Kopieren' }));
    await waitFor(async () => expect(await getEntry(entry.id)).toBeUndefined());
    expect(writeText).toHaveBeenCalledWith('Bogen\n\nName: Anna');
    expect(await screen.findByText(/Noch keine Einträge/)).toBeInTheDocument(); // /entries
    await userEvent.click(await screen.findByRole('button', { name: 'Rückgängig' }));
    await waitFor(async () => {
      const restored = await getEntry(entry.id);
      expect(restored?.answers).toEqual({ name: 'Anna' });
      expect(restored?.sharedAt).toBeNull(); // as if never shared: the next cleanup keeps it
    });
  });

  it('copy with setting never marks the entry shared and keeps it', async () => {
    const writeText = stubClipboard();
    const entry = await seed(form([name]), { name: 'Anna' });
    renderApp(`/entries/${entry.id}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Kopieren' }));
    expect(await screen.findByText('In die Zwischenablage kopiert.')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalled();
    expect((await getEntry(entry.id))?.sharedAt).not.toBeNull();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('copies html together with a plain-text fallback', async () => {
    await saveSettings({ copyFormat: 'html' });
    const write = vi.fn().mockResolvedValue(undefined);
    setClipboard({ write, writeText: vi.fn() });
    class FakeClipboardItem {
      constructor(public items: Record<string, Blob>) {}
    }
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
    const entry = await seed(form([name]), { name: 'Anna' });
    renderApp(`/entries/${entry.id}`);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'HTML' })).toBeChecked());
    await userEvent.click(screen.getByRole('button', { name: 'Kopieren' }));
    await waitFor(() => expect(write).toHaveBeenCalled());
    const item = write.mock.calls[0]?.[0]?.[0] as FakeClipboardItem;
    expect(await item.items['text/plain']?.text()).toBe('Bogen\n\nName: Anna');
    expect(await item.items['text/html']?.text()).toContain('<strong>Name</strong>');
  });

  it('stores numbers as numbers and an emptied input as unanswered', async () => {
    const num: Field = {
      id: 'n',
      type: 'number',
      label: 'Anzahl',
      required: false,
      options: { unit: 'kg' },
    };
    const entry = await seed(form([num]));
    renderApp(`/entries/${entry.id}`);
    const input = await screen.findByLabelText('Anzahl');
    await userEvent.type(input, '12');
    await waitFor(async () => expect((await getEntry(entry.id))?.answers).toEqual({ n: 12 }));
    await userEvent.clear(input);
    await waitFor(async () => expect((await getEntry(entry.id))?.answers).toEqual({ n: null }));
  });
});

describe('FillPage back button', () => {
  const today: Field = {
    id: 'day',
    type: 'date',
    label: 'Tag',
    required: false,
    options: { defaultToday: true },
  };

  it('goes back in the history when there is a previous page', async () => {
    const entry = await seed(form([name]));
    renderApp(['/library', `/entries/${entry.id}`]);
    await userEvent.click(await screen.findByRole('button', { name: 'Zurück' }));
    expect(await screen.findByRole('heading', { name: 'Bibliothek' })).toBeInTheDocument();
  });

  it('falls back to the forms list for an own form without history', async () => {
    const entry = await seed(form([name]), { name: 'Anna' });
    renderApp(`/entries/${entry.id}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Zurück' }));
    expect(await screen.findByRole('heading', { name: 'Meine Formulare' })).toBeInTheDocument();
  });

  it('falls back to the library for a library form without history', async () => {
    const f = form([name]);
    await saveForm(f);
    const entry = await createEntry(f, 'library');
    await updateAnswers(entry.id, { name: 'Anna' });
    renderApp(`/entries/${entry.id}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Zurück' }));
    expect(await screen.findByRole('heading', { name: 'Bibliothek' })).toBeInTheDocument();
  });

  it('falls back to the forms list for a library form while the library is hidden', async () => {
    features.library = false;
    try {
      const f = form([name]);
      await saveForm(f);
      const entry = await createEntry(f, 'library');
      await updateAnswers(entry.id, { name: 'Anna' });
      renderApp(`/entries/${entry.id}`);
      await userEvent.click(await screen.findByRole('button', { name: 'Zurück' }));
      expect(await screen.findByRole('heading', { name: 'Meine Formulare' })).toBeInTheDocument();
    } finally {
      features.library = true;
    }
  });

  it('discards an empty entry', async () => {
    const entry = await seed(form([name]));
    renderApp(`/entries/${entry.id}`);
    await screen.findByLabelText('Name');
    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    await screen.findByRole('heading', { name: 'Meine Formulare' });
    expect(await getEntry(entry.id)).toBeUndefined();
  });

  it('discards an entry that only holds the untouched "today" default', async () => {
    const entry = await seed(form([today]));
    renderApp(`/entries/${entry.id}`);
    await screen.findByText('Tag');
    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    await screen.findByRole('heading', { name: 'Meine Formulare' });
    expect(await getEntry(entry.id)).toBeUndefined();
  });

  it('keeps an entry once an answer was typed (flushed before leaving)', async () => {
    const entry = await seed(form([name, today]));
    renderApp(`/entries/${entry.id}`);
    await userEvent.type(await screen.findByLabelText('Name'), 'A');
    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    await screen.findByRole('heading', { name: 'Meine Formulare' });
    expect((await getEntry(entry.id))?.answers.name).toBe('A');
  });

  it('keeps a reopened entry even if its answers were cleared', async () => {
    const entry = await seed(form([name]), { name: 'Anna' });
    renderApp(`/entries/${entry.id}`);
    await userEvent.clear(await screen.findByLabelText('Name'));
    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    await screen.findByRole('heading', { name: 'Meine Formulare' });
    expect(await getEntry(entry.id)).toBeDefined();
  });

  it('keeps an entry that was shared', async () => {
    const entry = await seed(form([name]));
    await markShared(entry.id, new Date());
    renderApp(`/entries/${entry.id}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Zurück' }));
    await screen.findByRole('heading', { name: 'Meine Formulare' });
    expect(await getEntry(entry.id)).toBeDefined();
  });

  it('locks the form and ignores a second click while leaving', async () => {
    const entry = await seed(form([name]));
    renderApp(['/library', `/entries/${entry.id}`]);
    const input = await screen.findByLabelText('Name');
    const realGet = db.entries.get.bind(db.entries) as (key: string) => Promise<Entry | undefined>;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const get = vi.spyOn(db.entries, 'get').mockImplementation((async (key: string) => {
      await gate;
      return realGet(key);
    }) as never);
    const backButton = screen.getByRole('button', { name: 'Zurück' });
    await userEvent.click(backButton);
    await waitFor(() => expect(backButton).toBeDisabled());
    expect(input).toBeDisabled();
    await userEvent.click(backButton);
    expect(get).toHaveBeenCalledTimes(1);
    release();
    expect(await screen.findByRole('heading', { name: 'Bibliothek' })).toBeInTheDocument();
  });

  it('stays on the page and keeps the entry when saving before leaving fails', async () => {
    const entry = await seed(form([name]));
    renderApp(`/entries/${entry.id}`);
    const input = await screen.findByLabelText('Name');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db.entries, 'where').mockImplementation(() => {
      throw new Error('idb broken');
    });
    await userEvent.type(input, 'A');
    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(
      await screen.findByText('Antworten konnten nicht gespeichert werden.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Zurück' })).toBeEnabled();
    vi.restoreAllMocks();
    expect(await getEntry(entry.id)).toBeDefined();
  });
});
