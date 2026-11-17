import { useCallback, useState } from 'react';
import { applyUpdate } from './updateState';

/**
 * `applyUpdate` for buttons, with a busy flag. Problems (save failed / timed out) are shown by
 * `UpdatePrompt` from the shared update state.
 */
export function useApplyUpdate(): { apply: () => void; busy: boolean } {
  const [busy, setBusy] = useState(false);
  const apply = useCallback(() => {
    setBusy(true);
    void applyUpdate().finally(() => setBusy(false));
  }, []);
  return { apply, busy };
}
