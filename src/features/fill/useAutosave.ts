import { useCallback, useEffect, useRef } from 'react';
import type { Entry } from '../../db/db';
import { updateAnswers } from '../../db/entries';
import { registerOpenEntry } from '../../db/openEntries';
import { registerPendingWrite } from '../../pwa/pendingWrites';
import type { Answers } from '../../schema/form';

export type AutosaveOptions = {
  /**
   * The entry as the page loaded it. If the stored entry vanished meanwhile (cleanup or a delete
   * in another tab), the next write puts it back from this with the latest answers.
   */
  restoreFrom?: Entry;
  /** Called after a write had to put the vanished entry back. */
  onRestored?: () => void;
  /**
   * Called when writing starts failing (`true`) and when a write succeeds again afterwards
   * (`false`) -- only on these transitions, never once per keystroke.
   */
  onFailingChange?: (failing: boolean) => void;
};

/**
 * Autosave of `answers` for one entry: every change is written right away ("saved after every
 * change"); there is no debounce, because Chromium drops IndexedDB writes that are started while
 * the page unloads, so any waiting time is a window in which a reload or close loses the answer.
 *
 * - The answers passed on the first render are treated as already stored (no write on mount).
 * - Writes are coalesced: at most one `updateAnswers` is in flight. Changes that arrive meanwhile
 *   are written once more (only the latest value) when the running write finishes.
 * - `pagehide`, `beforeunload`, `visibilitychange` to hidden and unmount flush as a safety net.
 * - A failed write is logged and the answers stay pending: the next change or `flush()` retries.
 *   `onFailingChange` reports the failing/recovered transitions so the page can warn once.
 * - While mounted the entry is registered as open, so cleanup in this tab skips it.
 *
 * Returns `flush()`: starts a write if one is needed and resolves once every write issued so far,
 * including the follow-up for changes made while one was running, has finished (rejects if it
 * failed). Callers use it before reading the entry back.
 */
export function useAutosave(
  entryId: string,
  answers: Answers,
  options: AutosaveOptions = {},
): () => Promise<void> {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });
  const failing = useRef(false);
  const setFailing = useCallback((next: boolean) => {
    if (failing.current === next) return;
    failing.current = next;
    optionsRef.current.onFailingChange?.(next);
  }, []);
  const initial = useRef(answers);
  const latest = useRef(answers);
  const pending = useRef(false);
  const running = useRef<Promise<void> | null>(null);
  const lastResult = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback((): Promise<void> => {
    if (running.current) return running.current; // its loop also writes newer answers
    if (!pending.current) return lastResult.current;
    // The first updateAnswers call below runs synchronously (async functions run up to their
    // first await), so a flush from an event handler starts its transaction right there.
    const loop = (async () => {
      try {
        while (pending.current) {
          pending.current = false;
          const snapshot = latest.current;
          let result;
          try {
            result = await updateAnswers(entryId, snapshot, optionsRef.current.restoreFrom);
          } catch (error) {
            pending.current = true; // retried by the next change or flush
            setFailing(true);
            throw error;
          }
          setFailing(false);
          if (result === 'restored') optionsRef.current.onRestored?.();
        }
      } finally {
        running.current = null;
      }
    })();
    running.current = loop;
    lastResult.current = loop;
    loop.catch((error: unknown) => console.error('Autosave failed', error));
    return loop;
  }, [entryId, setFailing]);

  useEffect(() => registerOpenEntry(entryId), [entryId]);

  useEffect(() => {
    // Same reference as on mount (also under StrictMode's double effect run): nothing to save.
    if (answers === initial.current && !pending.current) return;
    latest.current = answers;
    pending.current = true;
    void flush().catch(() => {});
  }, [answers, flush]);

  // An app update reloads the page: it first awaits this flush (see src/pwa/pendingWrites.ts).
  useEffect(() => registerPendingWrite(flush), [flush]);

  useEffect(() => {
    const onLeave = () => void flush().catch(() => {});
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onLeave();
    };
    window.addEventListener('pagehide', onLeave);
    window.addEventListener('beforeunload', onLeave);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onLeave);
      window.removeEventListener('beforeunload', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      onLeave();
    };
  }, [flush]);

  return flush;
}
