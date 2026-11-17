// While LIBRARY_ENABLED is false, dist/ must hold no library chunk or library JSON
// (also not in the service worker precache). Usage: node scripts/check-library-absent.mjs [distDir=dist]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = process.argv[2] ?? 'dist';
const fail = (message) => {
  console.error(`check-library-absent: ${message}`);
  process.exit(1);
};

const flag = readFileSync('src/config/features.ts', 'utf8').match(
  /export\s+const\s+LIBRARY_ENABLED\s*=\s*(true|false)\b/,
)?.[1];
if (!flag) fail('LIBRARY_ENABLED not found in src/config/features.ts');
if (flag === 'true') {
  console.log('check-library-absent: LIBRARY_ENABLED is true, nothing to check');
  process.exit(0);
}

const sw = join(distDir, 'sw.js');
if (!existsSync(sw)) fail(`${sw} not found (run "npm run build" first)`);

const libraryNames = readdirSync('library')
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''));
const pattern = new RegExp(['LibraryPage', ...libraryNames].join('|'), 'i');

const bad = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (pattern.test(entry.name)) bad.push(path);
  }
};
walk(distDir);
const precached = readFileSync(sw, 'utf8').match(/url:"[^"]*"/g) ?? [];
for (const url of precached) if (pattern.test(url)) bad.push(`sw.js precache ${url}`);
if (bad.length > 0)
  fail(`library present although LIBRARY_ENABLED is false:\n  ${bad.join('\n  ')}`);
console.log('check-library-absent: ok (no library chunk or JSON in dist or precache)');
