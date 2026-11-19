/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import { LIBRARY_ENABLED } from './src/config/features.ts';
import { bogenLibraryPlugin } from './build/libraryPlugin.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/** Release version: `VITE_APP_VERSION` (e.g. tag `v1.2.0` -> `1.2.0`), else package.json. */
const appVersion = process.env.VITE_APP_VERSION?.trim().replace(/^v/, '') || pkg.version;

/** Short commit SHA: `VITE_GIT_SHA` (full SHAs are shortened), else `git rev-parse`, else `dev`. */
function gitSha(): string {
  const fromEnv = process.env.VITE_GIT_SHA?.trim();
  if (fromEnv) return /^[0-9a-f]{8,40}$/i.test(fromEnv) ? fromEnv.slice(0, 7) : fromEnv;
  try {
    const sha = execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return sha || 'dev';
  } catch {
    return 'dev';
  }
}

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE ?? '/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __GIT_SHA__: JSON.stringify(gitSha()),
    // Literal for the bundler so the library chunk drops out when the switch is off; tests always get true
    // (they toggle LIBRARY_ENABLED through vi.mock instead).
    __LIBRARY_BUNDLED__: JSON.stringify(mode === 'test' ? true : LIBRARY_ENABLED),
  },
  build: {
    // The largest first-load chunk is react-dom & co. (~370 kB minified);
    // the real guard is `npm run budget` (gzip, first load, hard limit 512 KB).
    chunkSizeWarningLimit: 500,
    rolldownOptions: {
      output: {
        // Libraries in their own chunks: they rarely change, so an app update leaves their
        // precache entries alone and the service worker downloads only the app chunks.
        // `$initial`: only modules of the first load; lazy parts (Modal, dates, dnd-kit)
        // stay in their lazy chunks instead of being pulled into the first load.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
              tags: ['$initial'],
              priority: 30,
            },
            {
              name: 'mantine',
              test: /node_modules[\\/](@mantine|@floating-ui|react-number-format|react-remove-scroll[^\\/]*|react-transition-group|react-style-singleton|use-callback-ref|use-sidecar|tslib|clsx)[\\/]/,
              tags: ['$initial'],
              priority: 20,
            },
            {
              name: 'dexie',
              test: /node_modules[\\/](dexie|dexie-react-hooks)[\\/]/,
              tags: ['$initial'],
              priority: 10,
            },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    ...(mode === 'analyze'
      ? [visualizer({ filename: 'stats.html', template: 'treemap', gzipSize: true })]
      : []),
    bogenLibraryPlugin(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'BOGEN',
        short_name: 'BOGEN',
        description: 'Baukasten für Offline-Formulare: Gestalten, Eintragen, Nachrichten teilen',
        lang: 'de',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        theme_color: '#0b5f7c',
        // Splash colour, same petrol as theme_color. Known limitation: Chrome (157, Android 16) paints the
        // installed app's nav bar in theme_color but forces dark buttons (FORCE_LIGHT_NAVIGATION_BARS);
        // neither colour here changes that.
        background_color: '#0b5f7c',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      // Lazy chunks (builder, library, dates, languages) must be precached for offline use.
      // favicon/apple-touch icon come in via the glob (an extra includeAssets listed them twice);
      // og-image.png is only for link previews and stays out of every update download.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,woff2}'],
        globIgnores: ['**/og-image.png'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['vitest.setup.ts'],
    globals: true,
    css: false,
    testTimeout: 15000,
    exclude: ['node_modules', 'dist', 'e2e/**'],
  },
}));
