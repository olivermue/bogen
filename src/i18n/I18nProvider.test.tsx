import { render, screen } from '@testing-library/react';
import { I18nProvider, useLanguage, useT } from './I18nProvider';
import { loadMessages } from './detect';
import type { MessageKey } from './de';

const custom = { 'app.title': 'Hallo {name}, {name}!' } as unknown as Record<MessageKey, string>;

function Probe({ name }: { name?: string }) {
  const t = useT();
  const lang = useLanguage();
  return (
    <p>
      {lang}|{t('app.title', name === undefined ? undefined : { name })}
    </p>
  );
}

describe('I18nProvider', () => {
  it('interpolates all placeholders and sets html lang', () => {
    render(
      <I18nProvider language="de" messages={custom}>
        <Probe name="Ada" />
      </I18nProvider>,
    );
    expect(screen.getByText('de|Hallo Ada, Ada!')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('de');
  });

  it('leaves missing params untouched', () => {
    render(
      <I18nProvider language="en" messages={custom}>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText('en|Hallo {name}, {name}!')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('throws outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/I18nProvider/);
    spy.mockRestore();
  });
});

describe('loadMessages', () => {
  it('loads each language with the same keys', async () => {
    const de = await loadMessages('de');
    const en = await loadMessages('en');
    expect(de['app.title']).toBe('BOGEN');
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
  });
});
