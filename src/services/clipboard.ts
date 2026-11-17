/**
 * Copies text (and optionally rich HTML) to the clipboard. Never throws.
 * With `html` and `ClipboardItem` support both flavours are written; otherwise
 * falls back to plain `writeText`. No usable API or any rejection -> 'failed'.
 */
export async function copyToClipboard(content: {
  text: string;
  html?: string;
}): Promise<'copied' | 'failed'> {
  try {
    const clipboard = navigator.clipboard as Clipboard | undefined;
    if (!clipboard) return 'failed';
    if (content.html !== undefined && typeof ClipboardItem !== 'undefined' && clipboard.write) {
      await clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([content.html], { type: 'text/html' }),
          'text/plain': new Blob([content.text], { type: 'text/plain' }),
        }),
      ]);
      return 'copied';
    }
    if (clipboard.writeText) {
      await clipboard.writeText(content.text);
      return 'copied';
    }
    return 'failed';
  } catch {
    return 'failed';
  }
}
