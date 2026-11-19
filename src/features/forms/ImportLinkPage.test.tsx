import { notifications } from '@mantine/notifications';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/db';
import type { Form } from '../../schema/form';
import { renderApp } from '../../test/renderApp';
import { mockViewport } from '../../test/viewport';
import { encodeFormPayload } from './formLink';

const form: Form = {
  id: 'shared-1',
  title: 'Krankmeldung',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
  fields: [
    { id: 'f1', type: 'yesNo', required: false, options: { yesLabel: 'Ja', noLabel: 'Nein' } },
    { id: 'f2', type: 'textLine', required: false, options: {} },
  ],
};

const importPath = async (f: Form = form) => `/import?v=1&d=${await encodeFormPayload(f)}`;

beforeEach(async () => {
  await db.forms.clear();
  mockViewport('desktop');
});

afterEach(() => {
  vi.restoreAllMocks();
  notifications.clean();
});

describe('ImportLinkPage', () => {
  it('shows the shared template and imports it on confirm', async () => {
    renderApp(['/forms', await importPath()]);
    expect(await screen.findByText('Diese Formularvorlage wurde mit dir geteilt:')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Krankmeldung' })).toBeVisible();
    expect(screen.getByText('Bausteine: 2')).toBeVisible();
    expect(await db.forms.count()).toBe(0);

    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    expect(await screen.findByText('Vorlage „Krankmeldung“ übernommen.')).toBeVisible();
    expect(await db.forms.get('shared-1')).toEqual(form);
    // Back on the forms list.
    expect(await screen.findByRole('button', { name: 'Neues Formular' })).toBeVisible();
  });

  it('cancel leaves the forms untouched', async () => {
    renderApp(await importPath());
    await userEvent.click(await screen.findByRole('button', { name: 'Abbrechen' }));
    expect(await screen.findByRole('button', { name: 'Neues Formular' })).toBeVisible();
    expect(await db.forms.count()).toBe(0);
  });

  it('offers replace or copy when the form already exists', async () => {
    await db.forms.put({ ...form, title: 'Alte Version' });
    renderApp(await importPath());
    expect(
      await screen.findByText(
        '„Krankmeldung“ ist schon vorhanden. Was soll mit der geteilten Version passieren?',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Übernehmen' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Als Kopie importieren' }));
    await waitFor(async () => expect(await db.forms.count()).toBe(2));
    const titles = (await db.forms.toArray()).map((f) => f.title).sort();
    expect(titles).toEqual(['Alte Version', 'Krankmeldung (Kopie)']);
  });

  it('replace overwrites the existing form', async () => {
    await db.forms.put({ ...form, title: 'Alte Version' });
    renderApp(await importPath());
    await userEvent.click(await screen.findByRole('button', { name: 'Ersetzen' }));
    await waitFor(async () => expect((await db.forms.get('shared-1'))?.title).toBe('Krankmeldung'));
    expect(await db.forms.count()).toBe(1);
  });

  it('reports a damaged link', async () => {
    const path = await importPath();
    renderApp(path.slice(0, path.length - 20));
    expect(
      await screen.findByText(
        'Der Link ist beschädigt oder unvollständig. Bitte den Absender, ihn noch einmal zu schicken.',
      ),
    ).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Zu meinen Formularen' }));
    expect(await screen.findByRole('button', { name: 'Neues Formular' })).toBeVisible();
  });

  it('reports a link from a newer app version', async () => {
    renderApp(`/import?v=2&d=abc`);
    expect(
      await screen.findByText(
        'Die Vorlage stammt aus einer neueren Version von BOGEN. Bitte die App aktualisieren.',
      ),
    ).toBeVisible();
  });

  it('rejects a link whose form is invalid', async () => {
    const broken = { ...form, fields: [{ id: 'x', type: 'nope' }] } as unknown as Form;
    renderApp(await importPath(broken));
    expect(await screen.findByText(/Der Link ist beschädigt/)).toBeVisible();
    expect(await db.forms.count()).toBe(0);
  });
});
