import { expect, test } from '@playwright/test';
import { createForm } from './helpers';

test('works offline after the first visit (precached lazy chunks)', async ({ page, context }) => {
  await page.goto('/');
  // Online: the lazy builder chunk loads and an own form is created (the library is hidden, D10).
  await createForm(page, 'Offline-Test', [
    ['Textzeile', 'Name'],
    ['Datum', 'Tag'],
  ]);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // First load is not controlled yet (no clients.claim in prompt mode); reload once.
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Offline-Test' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bibliothek' })).toHaveCount(0);

  // Lazy builder chunk, served from the precache while offline.
  await page.getByRole('button', { name: 'Neues Formular' }).click();
  await expect(page).toHaveURL(/#\/forms\/new$/);
  await expect(page.getByLabel('Titel')).toBeVisible();
  await page.getByRole('button', { name: 'Baustein hinzufügen' }).click();
  await page.getByRole('menuitem', { name: 'Datum', exact: true }).click();
  await expect(page.getByTestId('field-0')).toContainText('Datum');
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  // Unsaved changes: confirm leaving.
  await page.getByRole('button', { name: 'Verwerfen' }).click();
  await expect(page).toHaveURL(/#\/forms$/);

  // Fill page with a date field: lazy dates chunk, also from the precache.
  await page.getByRole('button', { name: 'Ausfüllen' }).click();
  await expect(page).toHaveURL(/#\/entries\//);
  await expect(page.getByRole('button', { name: /^Tag/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Offline-Test' })).toBeVisible();
  await page.getByRole('textbox', { name: /^Name/ }).fill('Erika');
  await page.reload();
  await expect(page.getByRole('textbox', { name: /^Name/ })).toHaveValue('Erika');
});

test('manifest is linked, parses and the app is installable', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const response = await request.get(new URL(href!, page.url()).toString());
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as Record<string, unknown>;
  expect(manifest).toMatchObject({
    name: 'BOGEN',
    short_name: 'BOGEN',
    display: 'standalone',
    start_url: '.',
    scope: '.',
  });

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as {
    installabilityErrors: { errorId: string }[];
  };
  expect(installabilityErrors).toEqual([]);
});
