import { expect, test } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { createForm } from './helpers';

// Update path (task 15b): build A is served, an entry is filled, build B (other version) is put
// under the same URL, the update check finds it, the indicator applies it -> version B runs and
// the entry with all answers is unchanged. Own builds and a small static server (cross-platform).

test.describe.configure({ mode: 'serial' });

const VITE = resolve('node_modules/vite/bin/vite.js');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function build(outDir: string, version: string, sha: string): Promise<void> {
  return new Promise((done, fail) => {
    const child = spawn(
      process.execPath,
      [VITE, 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'],
      {
        env: { ...process.env, VITE_BASE: '/', VITE_APP_VERSION: version, VITE_GIT_SHA: sha },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.on('error', fail);
    child.on('close', (code) =>
      code === 0 ? done() : fail(new Error(`vite build failed (${code}):\n${output}`)),
    );
  });
}

let workDir = '';
let servedDir = '';
let server: Server | undefined;
let origin = '';

test.beforeAll(async () => {
  test.setTimeout(300_000);
  workDir = mkdtempSync(join(tmpdir(), 'bogen-update-'));
  await Promise.all([
    build(join(workDir, 'a'), '1.0.0', 'aaaaaaa'),
    build(join(workDir, 'b'), '2.0.0', 'bbbbbbb'),
  ]);
  servedDir = join(workDir, 'a');
  server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    const file = normalize(join(servedDir, pathname === '/' ? 'index.html' : pathname));
    if (!file.startsWith(servedDir + sep) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(readFileSync(file));
  });
  await new Promise<void>((ready) => server!.listen(0, '127.0.0.1', ready));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise((closed) => (server ? server.close(closed) : closed(undefined)));
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

test('update: indicator appears, new version runs, entry and answers are kept', async ({
  page,
}, testInfo) => {
  // Build A, controlled by its service worker (first load is not controlled in prompt mode).
  await page.goto(`${origin}/#/about`);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
  await expect(page.getByText('Version 1.0.0 (aaaaaaa)')).toBeVisible();

  // Fill an entry.
  await page.getByRole('link', { name: 'Meine Formulare' }).click();
  await createForm(page, 'Krankmeldung', [
    ['Textzeile', 'Name'],
    ['Mehrfachauswahl', 'Symptome'],
    ['Textfeld (mehrzeilig)', 'Anmerkungen'],
  ]);
  await page.getByRole('button', { name: 'Ausfüllen' }).click();
  await expect(page).toHaveURL(/#\/entries\//);
  const entryUrl = page.url();
  await page.getByRole('textbox', { name: /^Name/ }).fill('Erika');
  await page.getByRole('checkbox', { name: 'Option 1' }).check();

  // Release build B under the same URL; trigger the update check (as the hourly/visibility check does).
  servedDir = join(workDir, 'b');
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });
  const indicator = page.getByRole('button', { name: 'Aktualisieren' });
  await expect(indicator).toBeVisible();
  await expect(page.getByText('Neue Version verfügbar')).toBeVisible();

  // Phone width (360 px): the indicator stays fully visible in the header; the page title gives way.
  const desktop = page.viewportSize()!;
  await page.setViewportSize({ width: 360, height: 740 });
  await expect(indicator).toBeInViewport({ ratio: 1 });
  const box = (await indicator.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  await expect(page.getByRole('heading', { level: 1, name: 'Eintrag' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('header-360.png') });
  await page.setViewportSize(desktop);

  // Type and update right away: the answers are saved before the reload.
  await page.getByRole('textbox', { name: /^Anmerkungen/ }).fill('kurz vor dem Update');
  const reloaded = page.waitForEvent('load');
  await indicator.click();
  await reloaded;

  expect(page.url()).toBe(entryUrl);
  await expect(page.getByRole('textbox', { name: /^Name/ })).toHaveValue('Erika');
  await expect(page.getByRole('textbox', { name: /^Anmerkungen/ })).toHaveValue(
    'kurz vor dem Update',
  );
  await expect(page.getByRole('checkbox', { name: 'Option 1' })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Aktualisieren' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Über' }).click();
  await expect(page.getByText('Version 2.0.0 (bbbbbbb)')).toBeVisible();
  await page.getByRole('link', { name: 'Meine Einträge' }).click();
  await expect(page.getByText('Krankmeldung')).toHaveCount(1);
});
