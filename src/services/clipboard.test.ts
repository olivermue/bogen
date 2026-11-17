import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from './clipboard';

class FakeClipboardItem {
  constructor(public items: Record<string, Blob>) {}
}

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

afterEach(() => {
  vi.unstubAllGlobals();
  setClipboard(undefined);
});

describe('copyToClipboard', () => {
  it('writes html and plain text as one ClipboardItem', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    setClipboard({ write, writeText: vi.fn() });
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
    expect(await copyToClipboard({ text: 'plain', html: '<b>h</b>' })).toBe('copied');
    const item = write.mock.calls[0]?.[0]?.[0] as FakeClipboardItem;
    expect(Object.keys(item.items).sort()).toEqual(['text/html', 'text/plain']);
    expect(await item.items['text/html']?.text()).toBe('<b>h</b>');
    expect(await item.items['text/plain']?.text()).toBe('plain');
  });

  it('uses writeText without html', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    expect(await copyToClipboard({ text: 'plain' })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('plain');
  });

  it('falls back to writeText when ClipboardItem is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    vi.stubGlobal('ClipboardItem', undefined);
    expect(await copyToClipboard({ text: 'plain', html: '<b>h</b>' })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('plain');
  });

  it('returns failed when no clipboard API exists', async () => {
    setClipboard(undefined);
    expect(await copyToClipboard({ text: 'x' })).toBe('failed');
  });

  it('returns failed on rejection and never throws', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    expect(await copyToClipboard({ text: 'x' })).toBe('failed');
    setClipboard({ write: vi.fn().mockRejectedValue(new Error('denied')) });
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
    expect(await copyToClipboard({ text: 'x', html: '<i>x</i>' })).toBe('failed');
  });
});
