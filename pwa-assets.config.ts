import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Generates pwa-192/512 from public/logo.svg. The small icons (pwa-64, favicon.ico, from
// logo-small.svg), the maskable/apple-touch badges and og-image.png are produced afterwards by
// scripts/generate-images.mjs (run: npm run generate:images).
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, sizes: [192, 512] },
  },
  images: ['public/logo.svg'],
});
