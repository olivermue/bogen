import { describe, expect, it } from 'vitest';
import type { Answers, Field, Form } from '../schema/form';
import { formatEntry } from './output';

const yn = { yes: 'Yes', no: 'No' };

const fields: Field[] = [
  { id: 'h', type: 'heading', required: false, options: { text: 'Person' } },
  { id: 'name', type: 'textLine', label: 'Name', required: true, options: {} },
  { id: 'note', type: 'textArea', label: 'Bemerkung', required: false, options: {} },
  {
    id: 'size',
    type: 'singleChoice',
    label: 'Größe',
    required: false,
    options: {
      display: 'radio',
      choices: [
        { id: 's', label: 'Klein' },
        { id: 'l', label: 'Groß' },
      ],
    },
  },
  {
    id: 'opts',
    type: 'multipleChoice',
    label: 'Optionen',
    required: false,
    options: {
      choices: [
        { id: 'a', label: 'Option A' },
        { id: 'b', label: 'Option B' },
        { id: 'c', label: 'Option C' },
      ],
    },
  },
  { id: 'day', type: 'date', label: 'Datum', required: false, options: {} },
  { id: 'at', type: 'time', label: 'Uhrzeit', required: false, options: {} },
  { id: 'kg', type: 'number', label: 'Gewicht', required: false, options: { unit: 'kg' } },
  {
    id: 'ok',
    type: 'yesNo',
    label: 'Einverstanden',
    required: false,
    options: { yesLabel: 'Ja', noLabel: 'Nein' },
  },
];

const form: Form = {
  id: 'f',
  title: 'Anmeldung <1>',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  fields,
};

const full: Answers = {
  name: 'Eva & Co',
  note: 'Zeile 1\nZeile 2',
  size: 'l',
  opts: ['a', 'c'],
  day: '2026-11-01',
  at: '14:30',
  kg: 1.5,
  ok: false,
};

describe('formatEntry', () => {
  it('omits unanswered optional fields', () => {
    const out = formatEntry(form, { name: 'x' }, 'text', 'de', yn);
    expect(out).not.toContain('Bemerkung');
    expect(out).not.toContain('Optionen');
  });

  it('formats markdown with list for multiple choice', () => {
    expect(formatEntry(form, full, 'markdown', 'de', yn)).toContain('- Option A\n- Option C');
  });

  it('escapes html in title, labels and answers', () => {
    const out = formatEntry(form, { name: '<b>x</b>' }, 'html', 'de', yn);
    expect(out).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(out).toContain('Anmeldung &lt;1&gt;');
    expect(out).not.toContain('<b>');
  });

  it('formats date answer in German and English', () => {
    expect(formatEntry(form, full, 'text', 'de', yn)).toContain('01.11.2026');
    expect(formatEntry(form, full, 'text', 'en', yn)).toContain('Datum: 11/1/2026');
  });

  it('formats numbers per language with unit', () => {
    expect(formatEntry(form, full, 'text', 'de', yn)).toContain('1,5 kg');
    expect(formatEntry(form, full, 'text', 'en', yn)).toContain('1.5 kg');
  });

  it('uses the yes/no labels of the field and keeps a "no" answer', () => {
    expect(formatEntry(form, full, 'text', 'de', yn)).toContain('Einverstanden: Nein');
  });

  it('skips choice ids that no longer exist', () => {
    const out = formatEntry(form, { opts: ['a', 'gone'], size: 'gone' }, 'text', 'de', yn);
    expect(out).toContain('- Option A');
    expect(out).not.toContain('gone');
    expect(out).not.toContain('Größe');
  });

  it('outputs only the answer for fields without label', () => {
    const f: Form = {
      ...form,
      fields: [{ id: 'a', type: 'textLine', required: false, options: {} }],
    };
    expect(formatEntry(f, { a: 'nur Antwort' }, 'text', 'de', yn)).toBe(
      'Anmeldung <1>\n\nnur Antwort',
    );
    expect(formatEntry(f, { a: 'x<y' }, 'html', 'de', yn)).toContain('<p>x&lt;y</p>');
  });

  it('trims title, labels and heading text', () => {
    const f: Form = {
      ...form,
      title: '  Bogen  ',
      fields: [
        { id: 'h', type: 'heading', required: false, options: { text: '  Teil 1 ' } },
        { id: 'a', type: 'textLine', label: ' Name  ', required: false, options: {} },
      ],
    };
    expect(formatEntry(f, { a: 'Eva' }, 'text', 'de', yn)).toBe('Bogen\n\nTeil 1\n\nName: Eva');
    expect(formatEntry(f, { a: 'Eva' }, 'markdown', 'de', yn)).toBe(
      '# Bogen\n\n## Teil 1\n\n**Name**: Eva',
    );
    expect(formatEntry(f, { a: 'Eva' }, 'html', 'de', yn)).toBe(
      '<h1>Bogen</h1>\n<h2>Teil 1</h2>\n<p><strong>Name</strong><br>Eva</p>',
    );
    // WhatsApp: "* Name *" would not render bold.
    expect(formatEntry(f, { a: 'Eva' }, 'whatsapp', 'de', yn)).toBe(
      '*Bogen*\n\n*Teil 1*\n\n*Name*: Eva',
    );
  });

  it('formats numbers without grouping and without floating-point noise', () => {
    const f: Form = {
      ...form,
      fields: [{ id: 'n', type: 'number', label: 'N', required: false, options: {} }],
    };
    const out = (n: number, lang: 'de' | 'en') => formatEntry(f, { n }, 'text', lang, yn);
    expect(out(0.1 + 0.2, 'de')).toContain('N: 0,3');
    expect(out(0.1 + 0.2, 'en')).toContain('N: 0.3');
    expect(out(1234567.5, 'de')).toContain('N: 1234567,5');
    expect(out(1234567.5, 'en')).toContain('N: 1234567.5');
    expect(out(-2, 'de')).toContain('N: -2');
    expect(out(0.1234567891234, 'en')).toContain('N: 0.1234567891234');
    // Small values keep their digits (no rounding to fraction digits).
    expect(out(1e-12, 'en')).toBe('Anmeldung <1>\n\nN: 0.000000000001');
    expect(out(-1e-12, 'de')).toContain('N: -0,000000000001');
    expect(out(0.000012345678912, 'en')).toContain('N: 0.000012345678912');
    expect(out(1.1 * 1.1, 'de')).toContain('N: 1,21');
    // -0 is shown as 0.
    expect(out(-0, 'de')).toBe('Anmeldung <1>\n\nN: 0');
    expect(out(-0, 'en')).toBe('Anmeldung <1>\n\nN: 0');
  });

  it('escapes Markdown in user text so it appears literally', () => {
    const f: Form = {
      ...form,
      title: '# *Titel*',
      fields: [
        { id: 'h', type: 'heading', required: false, options: { text: '[Teil] _1_ #' } },
        { id: 'a', type: 'textLine', label: 'a*b', required: false, options: {} },
        { id: 'b', type: 'textArea', label: 'Notiz', required: false, options: {} },
        {
          id: 'c',
          type: 'multipleChoice',
          label: 'Wahl',
          required: false,
          options: { display: 'checkbox', choices: [{ id: 'x', label: '+ mehr' }] },
        },
      ],
    };
    const out = formatEntry(
      f,
      { a: '`code` \\ x', b: '- Punkt\n> Zitat\n1. Liste\n#tag', c: ['x'] },
      'markdown',
      'de',
      yn,
    );
    expect(out).toBe(
      [
        '# \\# \\*Titel\\*',
        '## \\[Teil\\] \\_1\\_ \\#',
        '**a\\*b**: \\`code\\` \\\\ x',
        '**Notiz**\n\\- Punkt\n\\> Zitat\n1\\. Liste\n\\#tag',
        '**Wahl**\n- \\+ mehr',
      ].join('\n\n'),
    );
  });

  it('escapes raw HTML, autolinks, entities, strikethrough and setext underlines in Markdown', () => {
    const f: Form = {
      ...form,
      title: 'A <b>fett</b>',
      fields: [{ id: 'b', type: 'textArea', label: 'Notiz', required: false, options: {} }],
    };
    const out = formatEntry(
      f,
      { b: 'Titel\n===\n<https://x.de> ~~weg~~ &amp; Eva & Co' },
      'markdown',
      'de',
      yn,
    );
    expect(out).toBe(
      '# A \\<b>fett\\</b>\n\n**Notiz**\nTitel\n\\===\n\\<https://x.de> \\~\\~weg\\~\\~ \\&amp; Eva & Co',
    );
  });

  it('leaves user text unescaped in WhatsApp and plain text', () => {
    const f: Form = {
      ...form,
      title: '*Titel*',
      fields: [{ id: 'a', type: 'textLine', label: 'a_b', required: false, options: {} }],
    };
    expect(formatEntry(f, { a: '- x *y*' }, 'whatsapp', 'de', yn)).toBe(
      '**Titel**\n\n*a_b*: - x *y*',
    );
    expect(formatEntry(f, { a: '- x *y*' }, 'text', 'de', yn)).toBe('*Titel*\n\na_b: - x *y*');
  });

  it('text snapshot', () => {
    expect(formatEntry(form, full, 'text', 'de', yn)).toMatchInlineSnapshot(`
      "Anmeldung <1>

      Person

      Name: Eva & Co

      Bemerkung
      Zeile 1
      Zeile 2

      Größe: Groß

      Optionen
      - Option A
      - Option C

      Datum: 01.11.2026

      Uhrzeit: 14:30

      Gewicht: 1,5 kg

      Einverstanden: Nein"
    `);
  });
  it('markdown snapshot', () => {
    expect(formatEntry(form, full, 'markdown', 'de', yn)).toMatchInlineSnapshot(`
      "# Anmeldung \\<1>

      ## Person

      **Name**: Eva & Co

      **Bemerkung**
      Zeile 1
      Zeile 2

      **Größe**: Groß

      **Optionen**
      - Option A
      - Option C

      **Datum**: 01.11.2026

      **Uhrzeit**: 14:30

      **Gewicht**: 1,5 kg

      **Einverstanden**: Nein"
    `);
  });
  it('html snapshot', () => {
    expect(formatEntry(form, full, 'html', 'de', yn)).toMatchInlineSnapshot(`
      "<h1>Anmeldung &lt;1&gt;</h1>
      <h2>Person</h2>
      <p><strong>Name</strong><br>Eva &amp; Co</p>
      <p><strong>Bemerkung</strong><br>Zeile 1<br>Zeile 2</p>
      <p><strong>Größe</strong><br>Groß</p>
      <p><strong>Optionen</strong></p>
      <ul><li>Option A</li><li>Option C</li></ul>
      <p><strong>Datum</strong><br>01.11.2026</p>
      <p><strong>Uhrzeit</strong><br>14:30</p>
      <p><strong>Gewicht</strong><br>1,5 kg</p>
      <p><strong>Einverstanden</strong><br>Nein</p>"
    `);
  });
  it('whatsapp snapshot', () => {
    expect(formatEntry(form, full, 'whatsapp', 'de', yn)).toMatchInlineSnapshot(`
      "*Anmeldung <1>*

      *Person*

      *Name*: Eva & Co

      *Bemerkung*
      Zeile 1
      Zeile 2

      *Größe*: Groß

      *Optionen*
      - Option A
      - Option C

      *Datum*: 01.11.2026

      *Uhrzeit*: 14:30

      *Gewicht*: 1,5 kg

      *Einverstanden*: Nein"
    `);
  });
});
