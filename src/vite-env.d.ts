/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

/** App version (`VITE_APP_VERSION` without leading "v", else package.json), injected by Vite `define`. */
declare const __APP_VERSION__: string;
/** Short git SHA (`VITE_GIT_SHA`, else `git rev-parse --short HEAD`, else "dev"), injected by Vite `define`. */
declare const __GIT_SHA__: string;

interface ImportMetaEnv {
  /** URL of the public source repository; empty or unset hides the link on the About page. */
  readonly VITE_PUBLIC_REPO_URL?: string;
}

/** Build-time literal: library code is bundled (see vite.config.ts); mirrors `LIBRARY_ENABLED`. */
declare const __LIBRARY_BUNDLED__: boolean;
