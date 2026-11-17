import type { MantineColorScheme, MantineColorSchemeManager } from '@mantine/core';

// In-memory colour scheme manager: constraint R1 forbids localStorage.
// AppLayout drives it from the persisted settings (IndexedDB) via setColorScheme.
// subscribe/unsubscribe are no-ops: they only serve external changes (other tabs).
export function createMemoryColorSchemeManager(
  initial: MantineColorScheme = 'auto',
): MantineColorSchemeManager {
  let value: MantineColorScheme = initial;
  return {
    get: (defaultValue) => value ?? defaultValue,
    set: (scheme) => {
      value = scheme;
    },
    subscribe: () => {},
    unsubscribe: () => {},
    clear: () => {
      value = initial;
    },
  };
}
