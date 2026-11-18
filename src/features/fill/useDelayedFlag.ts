import { useEffect, useState } from 'react';

/**
 * `flag`, but turning true only after it has stayed true for `delayMs`; turning false at once.
 * For visual busy states (disabled fields, spinners) of actions that usually finish in a few
 * milliseconds: a short action then shows nothing instead of a flicker.
 */
export function useDelayedFlag(flag: boolean, delayMs = 300): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!flag) return;
    const timer = setTimeout(() => setShown(true), delayMs);
    return () => {
      clearTimeout(timer);
      setShown(false);
    };
  }, [flag, delayMs]);
  return flag && shown;
}
