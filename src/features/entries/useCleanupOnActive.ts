import { useEffect } from 'react';
import { runCleanup } from '../../domain/cleanup';

/** Runs the cleanup on mount and whenever the page becomes visible again. */
export function useCleanupOnActive(): void {
  useEffect(() => {
    let running = false;
    const run = async () => {
      if (running) return;
      running = true;
      try {
        await runCleanup();
      } finally {
        running = false;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void run();
    };
    void run();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
}
