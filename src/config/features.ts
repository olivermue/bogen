/**
 * Build-time switch for the built-in form library (`library/*.json`, menu item "Bibliothek",
 * route `/library`). While `false`, the menu item is hidden, `/library` redirects to `/forms`
 * and no library code or data lands in the bundle (the lazy imports are removed at build time).
 * To re-enable: set it to `true` (see README, "Bibliothek aktivieren").
 */
export const LIBRARY_ENABLED = false;
