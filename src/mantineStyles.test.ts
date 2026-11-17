import { describe, expect, it } from 'vitest';
import stylesSource from './mantineStyles.ts?raw';

/**
 * Guards the per-component Mantine CSS list in mantineStyles.ts: every component imported from
 * '@mantine/core' anywhere in src must have its stylesheet listed (an unstyled component is easy
 * to miss in review, e.g. Alert in the settings page).
 */
const sources = import.meta.glob<string>(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
});
const cssFiles = Object.keys(import.meta.glob('/node_modules/@mantine/core/styles/*.css')).map(
  (path) => path.replace(/^.*\//, '').replace(/\.css$/, ''),
);

/**
 * Components without a stylesheet of their own: they are styled through the files listed here
 * (verified in node_modules/@mantine/core/styles), or need none.
 */
const STYLED_VIA: Record<string, string[]> = {
  MantineProvider: ['baseline', 'global', 'default-css-variables'],
  FileButton: [],
  TextInput: ['Input'],
  Textarea: ['Input'],
  NativeSelect: ['Input'],
};

function usedComponents(): Set<string> {
  const used = new Set<string>();
  for (const code of Object.values(sources)) {
    for (const match of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*'@mantine\/core'/g)) {
      for (const raw of (match[1] ?? '').split(',')) {
        const name =
          raw
            .trim()
            .split(/\s+as\s+/)[0]
            ?.trim() ?? '';
        if (/^[A-Z]/.test(name)) used.add(name); // skips `type X` imports and helpers
      }
    }
  }
  return used;
}

describe('mantineStyles', () => {
  it('finds the Mantine stylesheets and the app components (sanity)', () => {
    expect(cssFiles).toContain('Button');
    expect(usedComponents()).toContain('Button');
  });

  it('lists the stylesheet of every component imported from @mantine/core', () => {
    const listed = new Set(
      [...stylesSource.matchAll(/@mantine\/core\/styles\/([\w-]+)\.css/g)].map((m) => m[1]),
    );
    const missing: string[] = [];
    for (const component of usedComponents()) {
      const needed = cssFiles.includes(component) ? [component] : STYLED_VIA[component];
      if (needed === undefined) {
        missing.push(`${component} (no own CSS file: add it to STYLED_VIA)`);
        continue;
      }
      for (const file of needed) if (!listed.has(file)) missing.push(`${component} -> ${file}.css`);
    }
    expect(missing).toEqual([]);
  });
});
