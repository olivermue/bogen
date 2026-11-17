import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { resolveBoot } from './boot';
import { requestPersistentStorage } from './db/settings';
import { renderBootFailure } from './pwa/bootFailure';
import {
  installChunkErrorRecovery,
  isReloadScheduled,
  recoverFromChunkError,
} from './pwa/chunkErrorRecovery';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

// A lazy chunk of an old version is gone after a release: reload once, then show the error view.
installChunkErrorRecovery(window);

void resolveBoot(navigator.languages).then((boot) => {
  if (!boot) {
    // No dictionary could be loaded (missing chunk): reload once, then offer the reset.
    if (!recoverFromChunkError()) renderBootFailure(root);
    return;
  }
  // A dictionary chunk failed and the fallback language loaded: the recovery reload is underway.
  if (isReloadScheduled()) return;
  void requestPersistentStorage();
  createRoot(root).render(
    <StrictMode>
      <App initial={boot} />
    </StrictMode>,
  );
});
