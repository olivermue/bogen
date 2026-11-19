import { notifications } from '@mantine/notifications';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/db';
import type { Form } from '../../schema/form';
import { renderApp } from '../../test/renderApp';
import { mockViewport } from '../../test/viewport';
import * as io from './importExport';
import * as link from './formLink';
import { parseFormFile } from '../../schema/formFile';

const features = vi.hoisted(() => ({ library: false }));
vi.mock('../../config/features', () => ({
  get LIBRARY_ENABLED() {
    return features.library;
  },
}));

const form = (id: string, title: string): Form => ({
  id,
  title,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
  fields: [
    { id: 'f1', type: 'yesNo', required: false, options: { yesLabel: 'Ja', noLabel: 'Nein' } },
    { id: 'f2', type: 'textLine', required: false, options: {} },
  ],
});

const file = (name: string, content: unknown) =>
  new File([typeof content === 'string' ? content : JSON.stringify(content)], name, {
    type: 'application/json',
  });

const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;

async function upload(...files: File[]) {
  await userEvent.upload(fileInput(), files);
}

/** Opens the "⋯" menu of the form card and picks an entry. */
async function menuAction(title: string, item: string) {
  await userEvent.click(
    await screen.findByRole('button', { name: `Weitere Aktionen für „${title}“` }),
  );
  await userEvent.click(await screen.findByRole('menuitem', { name: item }));
}

beforeEach(async () => {
  await db.forms.clear();
  await db.entries.clear();
  mockViewport('desktop');
});

afterEach(() => {
  vi.restoreAllMocks();
  notifications.clean();
});

describe('FormsPage', () => {
  it('empty state does not mention the library while it is hidden or when it is on', async () => {
    renderApp('/forms');
    expect(await screen.findByText(/Noch keine eigenen Formulare/)).toHaveTextContent(
      'Noch keine eigenen Formulare. Erstelle ein neues oder importiere eines.',
    );
    cleanup();
    features.library = true;
    try {
      renderApp('/forms');
      expect(await screen.findByText(/Noch keine eigenen Formulare/)).toHaveTextContent(
        'oder übernimm eines aus der Bibliothek',
      );
    } finally {
      features.library = false;
    }
  });

  it('shows a loader instead of an empty area while the list loads', async () => {
    const pending = new Promise<Form[]>(() => {});
    vi.spyOn(db.forms, 'toArray').mockReturnValue(pending as ReturnType<typeof db.forms.toArray>);
    renderApp('/forms');
    // Announced: the live region has the text as content, not only as aria-label.
    expect(await screen.findByRole('status', { name: 'Wird geladen …' })).toHaveTextContent(
      'Wird geladen …',
    );
    expect(screen.queryByText(/Noch keine eigenen Formulare/)).not.toBeInTheDocument();
  });

  it('shows an empty state with a call to action', async () => {
    renderApp('/forms');
    expect(await screen.findByText(/Noch keine eigenen Formulare/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Neues Formular' })).toBeInTheDocument();
  });

  it('gives list cards the petrol accent class', async () => {
    await db.forms.put(form('a', 'Mein Bogen'));
    renderApp('/forms');
    const title = await screen.findByText('Mein Bogen');
    expect(title.closest('.mantine-Card-root')).toHaveClass('bogen-list-card');
  });

  it('lists title, field count and last change', async () => {
    await db.forms.put(form('a', 'Mein Bogen'));
    renderApp('/forms');
    expect(await screen.findByText('Mein Bogen')).toBeInTheDocument();
    expect(screen.getByText('Bausteine: 2')).toBeInTheDocument();
    expect(screen.getByText('Zuletzt geändert: 02.01.2026')).toBeInTheDocument();
  });

  it('opens the form for filling when the card is clicked', async () => {
    await db.forms.put(form('a', 'Mein Bogen'));
    renderApp('/forms');
    await userEvent.click(await screen.findByRole('button', { name: '„Mein Bogen“ ausfüllen' }));
    expect(await screen.findByRole('heading', { name: 'Mein Bogen', level: 2 })).toBeVisible();
    expect(await db.entries.count()).toBe(1);
  });

  it('opens the builder from the pencil icon', async () => {
    await db.forms.put(form('a', 'Mein Bogen'));
    renderApp('/forms');
    await userEvent.click(await screen.findByRole('button', { name: '„Mein Bogen“ bearbeiten' }));
    expect(await screen.findByDisplayValue('Mein Bogen')).toBeInTheDocument();
    expect(await db.entries.count()).toBe(0);
  });

  it('duplicates a form as a copy', async () => {
    await db.forms.put(form('a', 'Bogen'));
    renderApp('/forms');
    await menuAction('Bogen', 'Duplizieren');
    expect(await screen.findByText('Bogen (Kopie)')).toBeInTheDocument();
    expect(await db.forms.count()).toBe(2);
  });

  it('asks before deleting and keeps the form on cancel', async () => {
    await db.forms.put(form('a', 'Bogen'));
    renderApp('/forms');
    await menuAction('Bogen', 'Löschen');
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await db.forms.count()).toBe(1);

    await menuAction('Bogen', 'Löschen');
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Löschen' }),
    );
    await waitFor(async () => expect(await db.forms.count()).toBe(0));
  });

  it('exports a single form and the selection', async () => {
    await db.forms.put(form('a', 'Eins'));
    await db.forms.put(form('b', 'Zwei'));
    const spy = vi.spyOn(io, 'exportForms').mockImplementation(() => {});
    renderApp('/forms');
    await menuAction('Eins', 'Als Datei exportieren');
    expect(spy).toHaveBeenLastCalledWith([expect.objectContaining({ id: 'a' })]);

    expect(screen.getByRole('button', { name: 'Auswahl exportieren' })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Formular „Eins“ auswählen' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Formular „Zwei“ auswählen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Auswahl exportieren' }));
    expect(spy.mock.lastCall?.[0].map((f) => f.id).sort()).toEqual(['a', 'b']);
  });

  describe('import', () => {
    it('imports the valid form of a file and reports the invalid one', async () => {
      renderApp('/forms');
      await screen.findByText(/Noch keine eigenen Formulare/);
      await upload(
        file('misch.json', {
          schemaVersion: 1,
          forms: [
            form('good', 'Gut'),
            {
              ...form('bad', 'Kaputt'),
              fields: [
                {
                  id: 'x',
                  type: 'yesNo',
                  required: false,
                  options: { yesLabel: 'Ja', noLabel: 'Nein' },
                },
                {
                  id: 'x',
                  type: 'yesNo',
                  required: false,
                  options: { yesLabel: 'Ja', noLabel: 'Nein' },
                },
              ],
            },
          ],
        }),
      );
      expect(await screen.findByText('Gut')).toBeInTheDocument();
      expect(
        await screen.findByText(/Datei „misch\.json“: Formular 2 „Kaputt“ ist ungültig/),
      ).toBeInTheDocument();
      expect(await db.forms.count()).toBe(1);
    });

    it('reports a non-JSON file and leaves the list unchanged', async () => {
      await db.forms.put(form('a', 'Bleibt'));
      renderApp('/forms');
      await screen.findByText('Bleibt');
      await upload(file('oops.json', '{oops'));
      expect(
        await screen.findByText('Datei „oops.json“ ist keine gültige JSON-Datei.'),
      ).toBeInTheDocument();
      expect(await db.forms.count()).toBe(1);
    });

    it('reports a wrong structure and an unsupported schemaVersion', async () => {
      renderApp('/forms');
      await screen.findByText(/Noch keine eigenen Formulare/);
      await upload(
        file('a.json', { hello: 'world' }),
        file('b.json', { schemaVersion: 2, forms: [] }),
      );
      expect(
        await screen.findByText(/Datei „a\.json“ ist keine BOGEN-Formulardatei/),
      ).toBeInTheDocument();
      expect(
        await screen.findByText(/Datei „b\.json“ stammt aus einer nicht unterstützten/),
      ).toBeInTheDocument();
      expect(await db.forms.count()).toBe(0);
    });

    it('offers replace / copy / skip on an id conflict and imports a copy', async () => {
      await db.forms.put(form('a', 'Original'));
      renderApp('/forms');
      await screen.findByText('Original');
      await upload(file('x.json', { schemaVersion: 1, forms: [form('a', 'Original')] }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('button', { name: 'Ersetzen' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Überspringen' })).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Als Kopie importieren' }));
      expect(await screen.findByText('Original (Kopie)')).toBeInTheDocument();
      expect(await db.forms.count()).toBe(2);
    });

    it('replaces the existing form on "Ersetzen"', async () => {
      await db.forms.put(form('a', 'Alt'));
      renderApp('/forms');
      await screen.findByText('Alt');
      await upload(file('x.json', { schemaVersion: 1, forms: [form('a', 'Neu')] }));
      await userEvent.click(await screen.findByRole('button', { name: 'Ersetzen' }));
      expect(await screen.findByText('Neu')).toBeInTheDocument();
      expect(await db.forms.count()).toBe(1);
    });

    it('sets updatedAt to now on "Ersetzen" so the form moves to the top', async () => {
      await db.forms.bulkPut([
        form('a', 'Alt'),
        { ...form('b', 'Neuer'), updatedAt: '2026-03-01T10:00:00.000Z' },
      ]);
      renderApp('/forms');
      await screen.findByText('Alt');
      const before = Date.now();
      await upload(file('x.json', { schemaVersion: 1, forms: [form('a', 'Ersetzt')] }));
      await userEvent.click(await screen.findByRole('button', { name: 'Ersetzen' }));
      await screen.findByText('Ersetzt');
      const stored = await db.forms.get('a');
      expect(Date.parse(stored!.updatedAt)).toBeGreaterThanOrEqual(before);
      const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
      expect(titles).toEqual(['Ersetzt', 'Neuer']);
    });

    it('reports a summary only after all conflicts are decided, naming counts > 0', async () => {
      await db.forms.bulkPut([form('a', 'A alt'), form('b', 'B alt')]);
      renderApp('/forms');
      await screen.findByText('A alt');
      await upload(
        file('x.json', {
          schemaVersion: 1,
          forms: [form('a', 'A neu'), form('b', 'B neu'), form('c', 'C')],
        }),
      );
      await userEvent.click(await screen.findByRole('button', { name: 'Ersetzen' }));
      await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));
      expect(screen.queryByText(/Import abgeschlossen/)).not.toBeInTheDocument();
      await userEvent.click(await screen.findByRole('button', { name: 'Überspringen' }));
      expect(
        await screen.findByText('Import abgeschlossen: 1 importiert, 1 ersetzt, 1 übersprungen.'),
      ).toBeInTheDocument();
    });

    it('reports a summary right away without conflicts (English)', async () => {
      renderApp('/forms', 'en');
      await screen.findByText(/No forms of your own yet/);
      await upload(file('x.json', { schemaVersion: 1, forms: [form('a', 'A'), form('b', 'B')] }));
      expect(await screen.findByText('Import finished: 2 imported.')).toBeInTheDocument();
    });

    it('keeps the existing form on "Überspringen"', async () => {
      await db.forms.put(form('a', 'Alt'));
      renderApp('/forms');
      await screen.findByText('Alt');
      await upload(file('x.json', { schemaVersion: 1, forms: [form('a', 'Neu')] }));
      await userEvent.click(await screen.findByRole('button', { name: 'Überspringen' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect((await db.forms.toArray()).map((f) => f.title)).toEqual(['Alt']);
    });

    it('imports the same id twice in one set as two forms', async () => {
      renderApp('/forms');
      await screen.findByText(/Noch keine eigenen Formulare/);
      await upload(
        file('x.json', { schemaVersion: 1, forms: [form('a', 'Eins'), form('a', 'Zwei')] }),
      );
      expect(await screen.findByText('Zwei (Kopie)')).toBeInTheDocument();
      expect(await db.forms.count()).toBe(2);
    });
  });
  describe('share as link', () => {
    it('shares a text with an import link that carries the form', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'share', { value: share, configurable: true });
      try {
        await db.forms.put(form('a', 'Mein Bogen'));
        renderApp('/forms');
        await menuAction('Mein Bogen', 'Als Link teilen');
        await waitFor(() => expect(share).toHaveBeenCalledOnce());
        const { text } = share.mock.calls[0]![0] as { text: string };
        expect(text).toMatch(
          /^BOGEN-Formularvorlage „Mein Bogen“\. Zum Übernehmen den Link öffnen:\n\S+#\/import\?v=1&d=[\w-]+$/,
        );
        const d = text.split('&d=')[1]!;
        expect(parseFormFile(await link.decodeFormPayload(d)).forms).toEqual([
          form('a', 'Mein Bogen'),
        ]);
      } finally {
        Reflect.deleteProperty(navigator, 'share');
      }
    });

    it('refuses forms too large for a link', async () => {
      vi.spyOn(link, 'buildFormLink').mockResolvedValue('x'.repeat(link.MAX_LINK_LENGTH + 1));
      const share = vi.fn();
      Object.defineProperty(navigator, 'share', { value: share, configurable: true });
      try {
        await db.forms.put(form('a', 'Riesig'));
        renderApp('/forms');
        await menuAction('Riesig', 'Als Link teilen');
        expect(
          await screen.findByText(
            'Das Formular ist zu groß für einen Link. Bitte stattdessen „Als Datei exportieren“ verwenden.',
          ),
        ).toBeInTheDocument();
        expect(share).not.toHaveBeenCalled();
      } finally {
        Reflect.deleteProperty(navigator, 'share');
      }
    });
  });
});
