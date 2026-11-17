// Regenerates the images that pwa-assets-generator does not cover (run: npm run generate:images):
// pwa-64x64.png + favicon.ico (from logo-small.svg), maskable/apple-touch badges, og-image.png.
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const url = (p) => new URL(`../${p}`, import.meta.url);
const PETROL = '#0b5f7c';

// Small icons: bolder line colours, hi-res render for sharp downscaling.
const small = await readFile(url('public/logo-small.svg'));
const render = (size) =>
  sharp(small, { density: Math.ceil((72 * size * 4) / 512) })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
await writeFile(url('public/pwa-64x64.png'), await render(64));

// favicon.ico with 16/32/48 (PNG-compressed entries).
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map(render));
const head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(sizes.length, 4);
let offset = head.length;
sizes.forEach((s, i) => {
  const o = 6 + 16 * i;
  head.writeUInt8(s, o);
  head.writeUInt8(s, o + 1);
  head.writeUInt16LE(1, o + 4);
  head.writeUInt16LE(32, o + 6);
  head.writeUInt32LE(pngs[i].length, o + 8);
  head.writeUInt32LE(offset, o + 12);
  offset += pngs[i].length;
});
await writeFile(url('public/favicon.ico'), Buffer.concat([head, ...pngs]));

// Home-screen badges: full-bleed petrol, white sheet (240x336 in a 512 box) scaled up.
// maskable: farthest sheet point from centre = corner-circle centre (92,140) + r 28 = 195.5
// units of 512; scale 1.02 -> 199.4 <= safe-zone radius 0.4*512 = 204.8.
const badge = (size, scale) => {
  const k = (size / 512) * scale;
  const t = (size - 512 * k) / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${PETROL}"/>
  <g transform="translate(${t} ${t}) scale(${k})">
    <rect x="136" y="88" width="240" height="336" rx="28" fill="#ffffff"/>
    <rect x="172" y="132" width="120" height="20" rx="10" fill="#a6d7e8"/>
    <rect x="172" y="184" width="168" height="16" rx="8" fill="#cfe4ec"/>
    <rect x="172" y="224" width="168" height="16" rx="8" fill="#cfe4ec"/>
    <path d="M182 332 L226 376 L330 276" fill="none" stroke="${PETROL}" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`,
  );
};
const badgePng = (size, scale) =>
  sharp(badge(size, scale), { density: 72 * 4 })
    .resize(size, size)
    .flatten({ background: PETROL })
    .png({ compressionLevel: 9 })
    .toBuffer();
await writeFile(url('public/maskable-icon-512x512.png'), await badgePng(512, 1.02));
await writeFile(url('public/apple-touch-icon-180x180.png'), await badgePng(180, 1.15));

const svg = await readFile(url('scripts/og-image.svg'));
const png = await sharp(svg, { density: 72 })
  .resize(1200, 630)
  .png({ compressionLevel: 9 })
  .toBuffer();
await writeFile(url('public/og-image.png'), png);
console.log(`icons + public/og-image.png written (${png.length} bytes)`);
