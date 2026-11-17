import { expect, type Page } from '@playwright/test';

/** Creates an own form (title plus one block per [type, label]) in the builder and saves it. */
export async function createForm(page: Page, title: string, fields: [string, string][]) {
  await page.getByRole('button', { name: 'Neues Formular' }).click();
  await expect(page).toHaveURL(/#\/forms\/new$/);
  await page.getByLabel('Titel').fill(title);
  for (const [index, [type, label]] of fields.entries()) {
    await page.getByRole('button', { name: 'Baustein hinzufügen' }).click();
    await page.getByRole('menuitem', { name: type, exact: true }).click();
    await page.getByTestId(`field-${index}`).getByLabel('Bezeichnung', { exact: true }).fill(label);
  }
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page).toHaveURL(/#\/forms$/);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}
