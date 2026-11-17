import { isOnline, resetApp, subscribeOnline } from './chunkErrorRecovery';

/**
 * Shown when no dictionary could be loaded at start (so no i18n): the sole i18n exception, both
 * languages hard-coded. Offers "Reset app" (own caches and worker only, never IndexedDB) because a
 * plain reload does not help while the worker keeps serving the same broken shell. Offline the
 * reset is disabled with a hint: it needs the network to load the app again.
 */
export function renderBootFailure(root: HTMLElement, reset: () => Promise<void> = resetApp): void {
  const text = document.createElement('p');
  text.textContent =
    'BOGEN: Start fehlgeschlagen. Bitte neu laden oder die App zurücksetzen (deine Daten bleiben erhalten). / ' +
    'BOGEN could not start. Please reload or reset the app (your data is kept).';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'App zurücksetzen / Reset app';
  const offlineHint = document.createElement('p');
  offlineHint.textContent =
    'Zum Zurücksetzen wird eine Internetverbindung benötigt. Deine Daten sind sicher. / ' +
    'Resetting needs an internet connection. Your data is safe.';
  let resetting = false;
  const update = () => {
    const online = isOnline();
    button.disabled = resetting || !online;
    offlineHint.hidden = online;
  };
  const unsubscribe = subscribeOnline(update);
  button.addEventListener('click', () => {
    if (!isOnline()) return;
    resetting = true;
    unsubscribe();
    update();
    void reset();
  });
  update();
  root.replaceChildren(text, button, offlineHint);
}
