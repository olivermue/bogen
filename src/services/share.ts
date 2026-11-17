/**
 * Shares text via the Web Share API.
 * - 'shared':    share sheet completed.
 * - 'cancelled': user dismissed the sheet (AbortError). Caller must NOT count this as shared.
 * - 'fallback':  no Web Share API, or it failed for another reason (e.g. NotAllowedError);
 *                opened https://wa.me/?text=... in a new tab. Counts as shared (the user
 *                continues in WhatsApp).
 * - 'failed':    popup blocked (window.open returned null); nothing was sent. Caller must
 *                NOT trigger afterSuccessfulShare.
 * `noopener` is not passed to window.open (it would always return null and hide blocked
 * popups); `opener` is cleared manually instead.
 * The wa.me URL is the only network target, reached by user-initiated navigation.
 */
export async function shareText(
  text: string,
): Promise<'shared' | 'cancelled' | 'fallback' | 'failed'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  const win = window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  if (!win) return 'failed';
  win.opener = null;
  return 'fallback';
}
