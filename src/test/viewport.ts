/** Simulates a desktop (wide) or mobile (narrow) viewport; reset after each test by vitest.setup.ts. */
export function mockViewport(kind: 'desktop' | 'mobile'): void {
  const desktop = kind === 'desktop';
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      // min-width queries match on desktop, max-width on mobile; others never match.
      matches: query.includes('min-width')
        ? desktop
        : query.includes('max-width')
          ? !desktop
          : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
