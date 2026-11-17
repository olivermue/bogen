import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { configure } from '@testing-library/react';

// Lazy chunks and Mantine transitions can be slow on loaded CI machines (default is 1000 ms).
configure({ asyncUtilTimeout: 5000 });

// Mantine needs window.matchMedia, which jsdom does not provide.
// Default = nothing matches (mobile). configurable + writable so tests can
// override it (see src/test/viewport.ts); reset after every test below.
const defaultMatchMedia = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: defaultMatchMedia,
});
afterEach(() => {
  window.matchMedia = defaultMatchMedia;
});

// Mantine ScrollArea etc. need ResizeObserver.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;

// Mantine 9 Textarea autosize listens on document.fonts ('loadingdone'), which jsdom lacks.
if (!('fonts' in document)) {
  Object.defineProperty(document, 'fonts', { configurable: true, value: new EventTarget() });
}

// The virtual PWA module only exists in the Vite build; default to "no update pending".
// Individual tests override this with their own vi.mock (see src/pwa/UpdatePrompt.test.tsx).
vi.mock('virtual:pwa-register/react', () => {
  // Stable like the real hook's function (it lives in useState).
  const updateServiceWorker = () => Promise.resolve();
  return {
    useRegisterSW: () => ({
      needRefresh: [false, () => {}],
      offlineReady: [false, () => {}],
      updateServiceWorker,
    }),
  };
});
