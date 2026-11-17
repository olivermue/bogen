import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareText } from './share';

function setShare(value: unknown) {
  Object.defineProperty(navigator, 'share', { value, configurable: true, writable: true });
}

afterEach(() => {
  vi.restoreAllMocks();
  setShare(undefined);
});

describe('shareText', () => {
  it('returns shared when navigator.share resolves', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setShare(share);
    expect(await shareText('hi')).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'hi' });
  });

  it('returns cancelled on AbortError and does not open anything', async () => {
    setShare(vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')));
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(await shareText('t')).toBe('cancelled');
    expect(open).not.toHaveBeenCalled();
  });

  it('falls back to wa.me when navigator.share is missing', async () => {
    setShare(undefined);
    const win = { opener: 'x' } as unknown as Window;
    const open = vi.spyOn(window, 'open').mockReturnValue(win);
    const text = 'a b&c\nd';
    expect(await shareText(text)).toBe('fallback');
    expect(open).toHaveBeenCalledWith('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
    expect(win.opener).toBeNull();
  });

  it('returns failed when the popup is blocked', async () => {
    setShare(undefined);
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(await shareText('t')).toBe('failed');
  });

  it('falls back to wa.me on other share errors', async () => {
    setShare(vi.fn().mockRejectedValue(new DOMException('x', 'NotAllowedError')));
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    expect(await shareText('t')).toBe('fallback');
    expect(open).toHaveBeenCalledTimes(1);
  });
});
