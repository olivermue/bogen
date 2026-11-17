import { detectLanguage, resolveLanguage } from './detect';

describe('detectLanguage', () => {
  it('picks the first de/en language', () => {
    expect(detectLanguage(['de-AT', 'en'])).toBe('de');
    expect(detectLanguage(['fr-FR', 'en-US'])).toBe('en');
  });
  it('falls back to en', () => {
    expect(detectLanguage(['fr-FR'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
  });
});

describe('resolveLanguage', () => {
  it('uses an explicit setting', () => {
    expect(resolveLanguage('de', ['en-US'])).toBe('de');
  });
  it('detects on auto', () => {
    expect(resolveLanguage('auto', ['de-DE'])).toBe('de');
  });
});
