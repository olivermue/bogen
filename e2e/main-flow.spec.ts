import { expect, test, type Page } from '@playwright/test';

// Main flow (task 15): build a form, reorder per drag & drop, fill, reload, copy as Markdown,
// export / delete / import, switch the language.
// Drag & drop uses real mouse events on the dnd-kit PointerSensor in both projects. The mobile
// project emulates a phone viewport with touch, but Playwright's mouse still produces pointer
// events, which the PointerSensor handles (the TouchSensor needs a 200 ms hold and is not used).

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

/** Mantine's sm breakpoint (48em): below it the menu is a burger overlay. */
const DESKTOP_MIN_WIDTH = 768;

async function goTo(page: Page, linkName: string) {
  // Decide by viewport, not by link visibility: the labels change language asynchronously.
  if ((page.viewportSize()?.width ?? 0) < DESKTOP_MIN_WIDTH) {
    await page.getByRole('button', { name: /^(Menü umschalten|Toggle menu)$/ }).click();
  }
  await page.getByRole('link', { name: linkName }).click();
}

async function addField(page: Page, type: string, label: string, index: number) {
  await page.getByRole('button', { name: 'Baustein hinzufügen' }).click();
  await page.getByRole('menuitem', { name: type, exact: true }).click();
  const card = page.getByTestId(`field-${index}`);
  await card.getByLabel('Bezeichnung', { exact: true }).fill(label);
  return card;
}

test('main flow: build, reorder, fill, copy, export/import, language', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/#\/forms$/);

  // 1. New form "Test": required text line, multiple choice, date.
  await page.getByRole('button', { name: 'Neues Formular' }).click();
  await expect(page).toHaveURL(/#\/forms\/new$/);
  await page.getByLabel('Titel').fill('Test');

  const name = await addField(page, 'Textzeile', 'Name', 0);
  await name.getByLabel('Pflichtfeld').check({ force: true });
  await addField(page, 'Mehrfachauswahl', 'Farben', 1);
  await addField(page, 'Datum', 'Datum', 2);

  // Collapse all cards so the three headers sit close together (no scrolling while dragging).
  for (let i = 0; i < 3; i++) {
    await page
      .getByTestId(`field-${i}`)
      .getByRole('button', { name: /zuklappen$/ })
      .click();
  }
  const cards = page.locator('[data-testid^="field-"]');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText('1. Textzeile: Name');
  await expect(cards.nth(2)).toContainText('3. Datum: Datum');

  // 2. Drag the date card ("Datum") above the text line: real pointer drag with the mouse.
  const handle = cards.nth(2).getByRole('button', { name: / verschieben / });
  const target = cards.nth(0).getByRole('button', { name: / verschieben / });
  await handle.scrollIntoViewIfNeeded();
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  const startX = from.x + from.width / 2;
  const startY = from.y + from.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const endY = to.y + to.height / 2 - 10;
  for (let step = 1; step <= 12; step++) {
    await page.mouse.move(startX, startY + ((endY - startY) * step) / 12);
  }
  await page.mouse.up();

  await expect(cards.nth(0)).toContainText('1. Datum: Datum');
  await expect(cards.nth(1)).toContainText('2. Textzeile: Name');
  await expect(cards.nth(2)).toContainText('3. Mehrfachauswahl: Farben');

  // dnd-kit swallows clicks for a few ms after a drop (its sensor is still being torn down), so
  // retry the click instead of sleeping.
  await expect(async () => {
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page).toHaveURL(/#\/forms$/, { timeout: 1_000 });
  }).toPass();
  await expect(page.getByRole('heading', { name: 'Test' })).toBeVisible();

  // The saved order survives: reopen the form in the builder.
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await expect(page.getByTestId('field-0')).toContainText('Datum: Datum');
  await expect(page.getByTestId('field-1')).toContainText('Textzeile: Name');
  await expect(page.getByTestId('field-2')).toContainText('Mehrfachauswahl: Farben');
  await page.getByRole('button', { name: 'Abbrechen' }).click();

  // 3. Fill (order: Datum, Name, Farben); after a reload the answers are still there.
  await page.getByRole('button', { name: 'Ausfüllen' }).click();
  await expect(page).toHaveURL(/#\/entries\//);
  await expect(page.getByRole('heading', { name: 'Test' })).toBeVisible();
  const labels = page.locator('label:visible', { hasText: /^(Datum|Name|Farben)/ });
  await expect(labels.nth(0)).toContainText('Datum');
  await expect(labels.nth(1)).toContainText('Name');

  await page.getByRole('checkbox', { name: 'Option 2' }).check();
  await page.getByRole('button', { name: /^Datum/ }).click();
  await page
    .getByRole('button', { name: /^15\b|, 15\b/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: /^Datum/ })).toContainText(/^\s*15\.\d\d\.\d{4}/);
  // Reload right after the last keystroke, no waiting for autosave (Review Focus 1).
  await page.getByRole('textbox', { name: /^Name/ }).fill('Erika');
  await page.reload();
  await expect(page.getByRole('textbox', { name: /^Name/ })).toHaveValue('Erika');
  await expect(page.getByRole('checkbox', { name: 'Option 2' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Option 1' })).not.toBeChecked();
  await expect(page.getByRole('button', { name: /^Datum/ })).toContainText(/15\.\d\d\.\d{4}/);

  // 4. Copy as Markdown: title and "- " list in the clipboard.
  await page.getByText('Markdown', { exact: true }).click();
  await page.getByRole('button', { name: 'Kopieren' }).click();
  await expect(page.getByText('In die Zwischenablage kopiert.')).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('# Test');
  expect(clip).toContain('**Name**: Erika');
  expect(clip).toMatch(/^- Option 2$/m);
  expect(clip).not.toContain('Option 1');

  // 5. Export, delete (confirm), import the downloaded file: form is back.
  await goTo(page, 'Meine Formulare');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportieren', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('test.json');
  const file = await download.path();

  await page.getByRole('button', { name: 'Löschen', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Test' })).toHaveCount(0);
  await expect(page.getByText('Noch keine eigenen Formulare.')).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByRole('heading', { name: 'Test' })).toBeVisible();
  await expect(page.getByText('Bausteine: 3')).toBeVisible();

  // 6. Language English: menu English, form contents unchanged.
  await goTo(page, 'Einstellungen');
  await page.getByLabel('Sprache').selectOption('en');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await goTo(page, 'My forms');
  await expect(page.getByRole('heading', { name: 'Test' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New form' })).toBeVisible();
  await page.getByRole('button', { name: 'Fill in' }).click();
  await expect(page.getByRole('heading', { name: 'Test' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^Name/ })).toBeVisible();
  await expect(page.getByText('Farben')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Option 1' })).toBeVisible();
});
