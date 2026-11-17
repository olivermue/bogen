import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/db';
import { renderApp } from '../../test/renderApp';
import { mockViewport } from '../../test/viewport';
import * as io from '../forms/importExport';
import * as loader from './loadLibrary';

vi.mock('../../config/features', () => ({ LIBRARY_ENABLED: true }));

beforeEach(async () => {
  await db.forms.clear();
  await db.entries.clear();
  mockViewport('desktop');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LibraryPage', () => {
  it('exports a library form', async () => {
    const spy = vi.spyOn(io, 'exportForms').mockImplementation(() => {});
    renderApp('/library');
    await userEvent.click(await screen.findByRole('button', { name: 'Exportieren' }));
    expect(spy).toHaveBeenCalledWith([expect.objectContaining({ title: 'Krankmeldung' })]);
  });

  it('shows the sample form without an edit action', async () => {
    renderApp('/library');
    expect(await screen.findByText('Krankmeldung')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ausfüllen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bearbeiten/ })).not.toBeInTheDocument();
  });

  it('copies a library form with a new id and kept field ids', async () => {
    renderApp('/library');
    await userEvent.click(await screen.findByRole('button', { name: 'Als Kopie übernehmen' }));
    await waitFor(async () => expect(await db.forms.count()).toBe(1));
    const [copy] = await db.forms.toArray();
    const [original] = await loader.loadLibrary();
    expect(copy?.id).not.toBe(original?.id);
    expect(copy?.title).toBe(original?.title);
    expect(copy?.fields.map((f) => f.id)).toEqual(original?.fields.map((f) => f.id));
  });

  it('fills directly by creating a library entry', async () => {
    renderApp('/library');
    await userEvent.click(await screen.findByRole('button', { name: 'Ausfüllen' }));
    await waitFor(async () => expect(await db.entries.count()).toBe(1));
    expect((await db.entries.toArray())[0]?.formSource).toBe('library');
  });

  it('shows an empty state', async () => {
    vi.spyOn(loader, 'loadLibrary').mockResolvedValue([]);
    renderApp('/library');
    expect(await screen.findByText('Die Bibliothek enthält keine Formulare.')).toBeInTheDocument();
  });

  it('shows a load error', async () => {
    vi.spyOn(loader, 'loadLibrary').mockRejectedValue(new Error('boom'));
    renderApp('/library');
    expect(
      await screen.findByText('Die Bibliothek konnte nicht geladen werden.'),
    ).toBeInTheDocument();
  });
});
