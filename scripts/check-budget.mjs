// Bundle budget: gzip size of everything index.html loads on first visit.
// Usage: node scripts/check-budget.mjs [distDir=dist] [limitKb=512]
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const distDir = process.argv[2] ?? 'dist';
const limitKb = Number(process.argv[3] ?? 512);
if (!Number.isFinite(limitKb) || limitKb <= 0) {
  console.error(`Invalid limit: ${process.argv[3]}`);
  process.exit(2);
}

function fail(message) {
  console.error(`check-budget: ${message}`);
  process.exit(1);
}

const indexPath = join(distDir, 'index.html');
if (!existsSync(indexPath)) fail(`${indexPath} not found (run "npm run build" first)`);
const html = readFileSync(indexPath, 'utf8');
const refs = new Set();
for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) ?? []) {
  const attr = (name) =>
    tag.match(new RegExp(String.raw`\s${name}\s*=\s*["']([^"']*)["']`, 'i'))?.[1];
  const isScript = /^<script/i.test(tag) && attr('type') === 'module' && attr('src');
  const rel = attr('rel');
  const isLink = /^<link/i.test(tag) && (rel === 'modulepreload' || rel === 'stylesheet');
  const ref = isScript ? attr('src') : isLink ? attr('href') : undefined;
  if (ref && !/^[a-z]+:\/\//i.test(ref)) refs.add(ref);
}

if (refs.size === 0) fail(`no first-load assets found in ${indexPath}; refusing to report 0 KB`);

// Refs carry the Vite base path (e.g. /bogen/assets/x.js): drop leading segments until the file exists.
function resolveFile(ref) {
  const segments = ref.split(/[?#]/)[0].split('/').filter(Boolean);
  for (let i = 0; i < segments.length; i++) {
    const rel = segments.slice(i).join('/');
    if (existsSync(join(distDir, rel))) return rel;
  }
  return fail(`referenced file not found in ${distDir}: ${ref}`);
}

const files = new Set([...refs].map(resolveFile));
const rows = [...files].map((file) => ({
  file,
  gzip: gzipSync(readFileSync(join(distDir, file)), { level: 9 }).length,
}));

const total = rows.reduce((sum, r) => sum + r.gzip, 0);
const kb = (n) => (n / 1024).toFixed(1).padStart(8);
const width = Math.max(4, ...rows.map((r) => r.file.length));
console.log(`${'File'.padEnd(width)}  gzip KB`);
for (const r of rows.sort((a, b) => b.gzip - a.gzip))
  console.log(`${r.file.padEnd(width)}  ${kb(r.gzip)}`);
console.log(`${'Total'.padEnd(width)}  ${kb(total)}  (limit ${limitKb} KB)`);

if (total / 1024 > limitKb) {
  console.error(`Budget exceeded: ${(total / 1024).toFixed(1)} KB > ${limitKb} KB`);
  process.exit(1);
}
