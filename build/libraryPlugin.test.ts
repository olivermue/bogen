import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bogenLibraryPlugin, validateLibraryDir } from './libraryPlugin.ts';

const form = (id: string) => ({
  id,
  title: 'T',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  fields: [],
});
const file = (...ids: string[]) => JSON.stringify({ schemaVersion: 1, forms: ids.map(form) });

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bogen-lib-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('validateLibraryDir', () => {
  it('returns nothing for valid files', () => {
    writeFileSync(join(dir, 'ok.json'), file('a'));
    expect(validateLibraryDir(dir)).toEqual([]);
  });

  it('reports a bad schemaVersion with the file name', () => {
    writeFileSync(join(dir, 'ok.json'), file('a'));
    writeFileSync(join(dir, 'bad.json'), JSON.stringify({ schemaVersion: 2, forms: [] }));
    const result = validateLibraryDir(dir);
    expect(result).toHaveLength(1);
    expect(result[0]?.file).toBe('bad.json');
    expect(result[0]?.errors[0]?.code).toBe('unsupportedVersion');
  });

  it('reports form ids duplicated across files', () => {
    writeFileSync(join(dir, 'a.json'), file('same'));
    writeFileSync(join(dir, 'b.json'), file('same'));
    const result = validateLibraryDir(dir);
    expect(result.map((r) => r.file)).toEqual(['b.json']);
    expect(result[0]?.errors[0]?.message).toContain('a.json');
  });

  it('reports form ids duplicated within one file', () => {
    writeFileSync(join(dir, 'a.json'), file('same', 'same'));
    expect(validateLibraryDir(dir)[0]?.file).toBe('a.json');
  });
});

describe('bogenLibraryPlugin', () => {
  it('fails the build naming file and path', () => {
    writeFileSync(
      join(dir, 'bad.json'),
      JSON.stringify({ schemaVersion: 1, forms: [{ id: 'x' }] }),
    );
    const plugin = bogenLibraryPlugin(dir);
    const hook = plugin.buildStart as (this: { error: (m: string) => never }) => void;
    const ctx = {
      error: (m: string): never => {
        throw new Error(m);
      },
    };
    expect(() => hook.call(ctx)).toThrow(/bad\.json/);
  });
});
