import { notifications } from '@mantine/notifications';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/db';
import { getForm } from '../../db/forms';
import type { Form } from '../../schema/form';
import { hasUnsavedWork } from '../../pwa/pendingWrites';
import { handleNeedReload, resetUpdateState } from '../../pwa/updateState';
import { renderApp } from '../../test/renderApp';
import { mockViewport } from '../../test/viewport';

beforeEach(async () => {
  await db.forms.clear();
  await db.entries.clear();
  mockViewport('desktop');
});

afterEach(() => {
  vi.restoreAllMocks();
  notifications.clean();
  act(() => resetUpdateState());
});

async function addField(name: string) {
  await userEvent.click(await screen.findByRole('button', { name: 'Baustein hinzufügen' }));
  await userEvent.click(await screen.findByRole('menuitem', { name }));
}

async function savedForm(): Promise<Form> {
  await waitFor(async () => expect(await db.forms.count()).toBe(1));
  const [form] = await db.forms.toArray();
  return (await getForm(form!.id))!;
}

describe('BuilderPage', () => {
  it('offers all 9 field types', async () => {
    renderApp('/forms/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Baustein hinzufügen' }));
    expect(await screen.findAllByRole('menuitem')).toHaveLength(9);
  });

  it('stores a relative earliest date bound', async () => {
    renderApp('/forms/new');
    await userEvent.type(await screen.findByLabelText(/Titel/), 'Bogen');
    await addField('Datum');
    await userEvent.selectOptions(screen.getByLabelText('Früheste Auswahl'), 'relative');
    expect(screen.getByLabelText('Früheste Auswahl: heute + N Tage')).toHaveValue('0');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const form = await savedForm();
    const field = form.fields[0];
    if (field?.type !== 'date') throw new Error('expected date');
    expect(field.options.min).toEqual({ kind: 'relative', days: 0 });
  });

  it('keeps partial numeric input: decimal step, negative min, negative relative days', async () => {
    renderApp('/forms/new');
    await userEvent.type(await screen.findByLabelText(/Titel/), 'Bogen');
    await addField('Zahl');
    await userEvent.type(screen.getByLabelText('Schrittweite'), '0,5');
    await userEvent.type(screen.getByLabelText('Minimum'), '-3');
    expect(screen.getByLabelText('Schrittweite')).toHaveValue('0,5');
    expect(screen.getByLabelText('Minimum')).toHaveValue('-3');
    await addField('Datum');
    await userEvent.selectOptions(screen.getByLabelText('Früheste Auswahl'), 'relative');
    const days = screen.getByLabelText('Früheste Auswahl: heute + N Tage');
    await userEvent.clear(days);
    await userEvent.type(days, '-3');
    expect(days).toHaveValue('-3');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const form = await savedForm();
    const [num, date] = form.fields;
    if (num?.type !== 'number' || date?.type !== 'date') throw new Error('unexpected fields');
    expect(num.options.step).toBe(0.5);
    expect(num.options.min).toBe(-3);
    expect(date.options.min).toEqual({ kind: 'relative', days: -3 });
  });

  it('shows translated errors for an empty fixed date (no raw Zod text)', async () => {
    renderApp('/forms/new');
    await userEvent.type(await screen.findByLabelText(/Titel/), 'Bogen');
    await addField('Datum');
    await userEvent.selectOptions(screen.getByLabelText('Früheste Auswahl'), 'fixed');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Bitte ein gültiges Datum angeben.')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid/)).not.toBeInTheDocument();
    expect(await db.forms.count()).toBe(0);
  });

  it('reports a failed save and stays on the page', async () => {
    vi.spyOn(db.forms, 'put').mockRejectedValue(new Error('disk full'));
    renderApp('/forms/new');
    await userEvent.type(await screen.findByLabelText(/Titel/), 'Bogen');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(
      await screen.findByText('Speichern fehlgeschlagen. Bitte erneut versuchen.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Titel/)).toHaveValue('Bogen');
  });

  it('reorders with the move-down button', async () => {
    renderApp('/forms/new');
    await userEvent.type(await screen.findByLabelText(/Titel/), 'Bogen');
    await addField('Textzeile');
    await addField('Datum');
    await userEvent.click(screen.getAllByRole('button', { name: /nach unten$/ })[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect((await savedForm()).fields.map((f) => f.type)).toEqual(['date', 'textLine']);
  });

  it('gives builder cards the petrol left accent like the list cards', async () => {
    renderApp('/forms/new');
    await addField('Textzeile');
    const card = screen.getByTestId('field-0');
    expect(card).toHaveClass('bogen-card');
    expect(card).toHaveClass('bogen-list-card');
  });

  it('names card header and actions with position, type and label', async () => {
    renderApp('/forms/new');
    await addField('Textzeile');
    await addField('Datum');
    await userEvent.type(screen.getAllByLabelText('Bezeichnung')[0]!, 'Name');
    const card = within(screen.getByTestId('field-0'));
    const header = card.getByRole('button', { name: '1. Textzeile: Name – zuklappen' });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    // Label in name (WCAG 2.5.3): the accessible name starts with the visible text.
    expect(header).toHaveTextContent('1. Textzeile: Name');
    expect(header.getAttribute('aria-label')!.startsWith(header.textContent!)).toBe(true);
    await userEvent.click(header);
    expect(card.getByRole('button', { name: '1. Textzeile: Name – aufklappen' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    for (const name of [
      'Baustein 1 „Name“ nach oben',
      'Baustein 1 „Name“ nach unten',
      'Baustein 1 „Name“ duplizieren',
      'Baustein 1 „Name“ löschen',
      'Baustein 1 „Name“ verschieben (Ziehen oder Leertaste)',
    ]) {
      expect(card.getByRole('button', { name })).toBeInTheDocument();
    }
    const second = within(screen.getByTestId('field-1'));
    expect(
      second.getByRole('button', { name: 'Baustein 2 „ohne Bezeichnung“ nach unten' }),
    ).toBeDisabled();
  });

  it('translates the drag-and-drop role description and instructions (English)', async () => {
    renderApp('/forms/new', 'en');
    await userEvent.click(await screen.findByRole('button', { name: 'Add field' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Text line' }));
    const handle = screen.getByRole('button', {
      name: 'Move field 1 “untitled” (drag or press space)',
    });
    expect(handle).toHaveAttribute('aria-roledescription', 'sortable field');
    expect(handle).toHaveAccessibleDescription(
      'Press space to pick up, arrow keys to move, space to drop, escape to cancel.',
    );
    expect(
      screen.getByRole('button', { name: '1. Text line: untitled – collapse' }),
    ).toBeInTheDocument();
  });

  it('uses the German drag-and-drop role description', async () => {
    renderApp('/forms/new');
    await addField('Textzeile');
    expect(screen.getByRole('button', { name: /verschieben/ })).toHaveAttribute(
      'aria-roledescription',
      'verschiebbarer Baustein',
    );
  });

  it('edits a heading with heading text before help text and without a label input', async () => {
    renderApp('/forms/new');
    await addField('Überschrift');
    const card = screen.getByTestId('field-0');
    expect(within(card).queryByLabelText('Bezeichnung')).not.toBeInTheDocument();
    const heading = within(card).getByLabelText('Überschrift');
    const help = within(card).getByLabelText('Hilfetext');
    expect(heading.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('disables move buttons at the ends', async () => {
    renderApp('/forms/new');
    await addField('Textzeile');
    await addField('Datum');
    expect(screen.getAllByRole('button', { name: /nach oben$/ })[0]).toBeDisabled();
    expect(screen.getAllByRole('button', { name: /nach unten$/ })[1]).toBeDisabled();
  });

  it('blocks saving a single choice without options and shows the error', async () => {
    renderApp('/forms/new');
    await userEvent.type(await screen.findByLabelText(/Titel/), 'Bogen');
    await addField('Einzelauswahl');
    await userEvent.click(screen.getByRole('button', { name: 'Option 1 entfernen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Option 1 entfernen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Mindestens eine Option ist nötig.')).toBeInTheDocument();
    expect(await db.forms.count()).toBe(0);
  });

  it('requires a title', async () => {
    renderApp('/forms/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Bitte einen Titel eingeben.')).toBeInTheDocument();
    expect(await db.forms.count()).toBe(0);
  });

  it('loads and edits an existing form', async () => {
    await db.forms.put({
      id: 'x',
      title: 'Alt',
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
      fields: [{ id: 'f1', type: 'textLine', required: false, label: 'Name', options: {} }],
    });
    renderApp('/forms/x/edit');
    const title = await screen.findByLabelText(/Titel/);
    expect(title).toHaveValue('Alt');
    await userEvent.type(title, ' neu');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(async () => expect((await getForm('x'))?.title).toBe('Alt neu'));
    expect((await getForm('x'))?.createdAt).toBe('2026-01-01T10:00:00.000Z');
  });

  it('shows a message for an unknown form', async () => {
    renderApp('/forms/nope/edit');
    expect(await screen.findByText('Formular nicht gefunden.')).toBeInTheDocument();
  });

  it('asks before leaving with unsaved changes', async () => {
    renderApp('/forms/new');
    await userEvent.type(await screen.findByLabelText(/Titel/), 'Bogen');
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(await screen.findByText('Änderungen verwerfen?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Weiter bearbeiten' }));
    await waitFor(() =>
      expect(screen.queryByText('Änderungen verwerfen?')).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/Titel/)).toHaveValue('Bogen');
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Verwerfen' }));
    expect(await screen.findByText(/Noch keine eigenen Formulare/)).toBeInTheDocument();
  });

  it('guards unsaved changes against closing the tab and against update reloads', async () => {
    renderApp('/forms/new');
    const title = await screen.findByLabelText(/Titel/);
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    expect(hasUnsavedWork()).toBe(false);

    await userEvent.type(title, 'Bogen');
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
    expect(hasUnsavedWork()).toBe(true);
    const reload = vi.fn();
    await act(() => handleNeedReload(reload));
    expect(reload).not.toHaveBeenCalled();

    await userEvent.clear(title); // back to the saved state
    await waitFor(() => expect(hasUnsavedWork()).toBe(false));
  });

  it('previews the unsaved form with disabled fill fields, without saving', async () => {
    renderApp('/forms/new');
    await userEvent.type(await screen.findByLabelText(/Titel/), 'Bogen');
    await addField('Textzeile');
    await userEvent.type(screen.getByLabelText('Bezeichnung'), 'Vorname');
    await addField('Ja/Nein');
    await addField('Datum');
    await userEvent.type(screen.getAllByLabelText('Bezeichnung')[2]!, 'Termin');

    await userEvent.click(screen.getByRole('switch', { name: 'Vorschau' }));
    expect(screen.getByRole('heading', { name: 'Bogen' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Vorname' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Ja' })).toBeDisabled();
    expect(await screen.findByRole('button', { name: 'Termin' })).toBeDisabled(); // lazy date chunk
    expect(screen.queryByLabelText('Bezeichnung')).not.toBeInTheDocument();
    expect(await db.forms.count()).toBe(0);
    expect(await db.entries.count()).toBe(0);

    // Back to editing: unsaved state is kept.
    await userEvent.click(screen.getByRole('switch', { name: 'Vorschau' }));
    expect(screen.getAllByLabelText('Bezeichnung')[0]).toHaveValue('Vorname');
    expect(screen.getByLabelText(/Titel/)).toHaveValue('Bogen');
  });

  it('stores chips display for single and multiple choice and previews chips', async () => {
    renderApp('/forms/new');
    await userEvent.type(await screen.findByLabelText(/Titel/), 'Bogen');
    await addField('Einzelauswahl');
    await addField('Mehrfachauswahl');
    const [singleDisplay, multiDisplay] = screen.getAllByLabelText('Darstellung');
    expect(multiDisplay).toHaveValue('checkbox');
    await userEvent.selectOptions(singleDisplay!, 'Chips');
    await userEvent.selectOptions(multiDisplay!, 'Chips');
    await userEvent.click(screen.getByRole('switch', { name: 'Vorschau' }));
    expect(screen.getByRole('radio', { name: 'Option 1' })).toBeDisabled();
    expect(screen.getAllByRole('checkbox', { name: 'Option 1' })).toHaveLength(1);
    expect(document.querySelectorAll('.mantine-Chip-root')).toHaveLength(4);
    await userEvent.click(screen.getByRole('switch', { name: 'Vorschau' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const saved = await savedForm();
    expect(saved.fields.map((f) => (f.type === 'heading' ? '' : f.options))).toMatchObject([
      { display: 'chips' },
      { display: 'chips' },
    ]);
  });

  it('stores the display of a yes/no field and previews it', async () => {
    renderApp('/forms/new');
    await userEvent.type(await screen.findByLabelText(/Titel/), 'Bogen');
    await addField('Ja/Nein');
    expect(screen.getByLabelText('Darstellung')).toHaveValue('radio');
    await userEvent.selectOptions(screen.getByLabelText('Darstellung'), 'Aufklappliste');
    await userEvent.click(screen.getByRole('switch', { name: 'Vorschau' }));
    expect(screen.getByRole('combobox')).toBeDisabled();
    await userEvent.click(screen.getByRole('switch', { name: 'Vorschau' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    const field = (await savedForm()).fields[0];
    if (field?.type !== 'yesNo') throw new Error('expected yesNo');
    expect(field.options.display).toBe('dropdown');
  });

  it('does not ask after a successful save', async () => {
    renderApp('/forms/new');
    await userEvent.type(await screen.findByLabelText(/Titel/), 'Bogen');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Bogen')).toBeInTheDocument();
    expect(screen.queryByText('Änderungen verwerfen?')).not.toBeInTheDocument();
  });

  it('back button leaves an untouched builder for /forms', async () => {
    renderApp('/forms/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Zurück' }));
    expect(await screen.findByText(/Noch keine eigenen Formulare/)).toBeInTheDocument();
  });

  it('back button asks before discarding unsaved changes, then goes to /forms', async () => {
    renderApp('/forms/new');
    await userEvent.type(await screen.findByLabelText(/Titel/), 'Bogen');
    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(await screen.findByText('Änderungen verwerfen?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
    expect(await screen.findByText(/Noch keine eigenen Formulare/)).toBeInTheDocument();
  });
});
