import type { Language } from '../i18n/detect';
import type { Answers, Field, Form } from '../schema/form';
import { formatDate, formatTime } from './dates';
import { formatNumber } from './numbers';
import { isAnswered } from './validation';

export type OutputFormat = 'text' | 'markdown' | 'html' | 'whatsapp';

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'qa'; label: string | undefined; answer: string | string[] };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeMarkdownBlockStarts(s: string): string {
  return (
    s
      .replace(/^(\s*)([#>+-])/gm, '$1\\$2')
      .replace(/^(\s*\d{1,9})([.)])(?=\s|$)/gm, '$1\\$2')
      // A line of "=" under a text line would turn that line into a setext heading.
      .replace(/^(\s*)(=+\s*)$/gm, '$1\\$2')
  );
}

/**
 * Markdown-safe user text: inline markers (backslash, backtick, `*`, `_`, `~`, `[`, `]`, `<` for
 * raw HTML and autolinks, `&` before an entity) are escaped everywhere, block markers (`#`, `>`,
 * `-`, `+`, `1.`, a line of `=`) at the start of a line, so the text appears literally.
 * `lineStart=false`: the text follows other output on its first line (e.g. "**Label**: answer"),
 * so only its later lines start a Markdown line.
 */
export function escapeMarkdown(s: string, lineStart = true): string {
  const inline = s.replace(/[\\`*_~[\]<]/g, '\\$&').replace(/&(?=#?\w+;)/g, '\\&');
  if (lineStart) return escapeMarkdownBlockStarts(inline);
  const nl = inline.indexOf('\n');
  return nl < 0
    ? inline
    : inline.slice(0, nl + 1) + escapeMarkdownBlockStarts(inline.slice(nl + 1));
}

/** "Title #" would lose its trailing "#" as an ATX closing sequence. */
function escapeClosingHashes(s: string): string {
  return s.replace(/(\s)(#+)(\s*)$/, '$1\\$2$3');
}

/** Answer text for a field; `undefined` = nothing to output. */
function answerOf(
  field: Field,
  value: unknown,
  lang: Language,
  labels: { yes: string; no: string },
): string | string[] | undefined {
  switch (field.type) {
    case 'heading':
      return undefined;
    case 'textLine':
    case 'textArea':
      return typeof value === 'string' ? value.trim() : undefined;
    case 'singleChoice':
      // Unknown id (option removed): skip silently.
      return field.options.choices.find((c) => c.id === value)?.label;
    case 'multipleChoice': {
      if (!Array.isArray(value)) return undefined;
      const picked = field.options.choices.filter((c) => value.includes(c.id)).map((c) => c.label);
      return picked.length > 0 ? picked : undefined;
    }
    case 'date':
      return typeof value === 'string' ? formatDate(value, lang) : undefined;
    case 'time':
      return typeof value === 'string' ? formatTime(value, lang) : undefined;
    case 'number': {
      if (typeof value !== 'number') return undefined;
      const n = formatNumber(value, lang);
      return field.options.unit ? `${n} ${field.options.unit}` : n;
    }
    case 'yesNo':
      if (typeof value !== 'boolean') return undefined;
      return value ? field.options.yesLabel || labels.yes : field.options.noLabel || labels.no;
  }
}

function toBlocks(
  form: Form,
  answers: Answers,
  lang: Language,
  labels: { yes: string; no: string },
): Block[] {
  const blocks: Block[] = [];
  for (const field of form.fields) {
    if (field.type === 'heading') {
      const text = field.options.text.trim();
      if (text !== '') blocks.push({ kind: 'heading', text });
      continue;
    }
    const value = answers[field.id];
    if (!isAnswered(field, value)) continue;
    const answer = answerOf(field, value, lang, labels);
    if (answer === undefined || answer === '') continue;
    const label = field.label?.trim() || undefined;
    blocks.push({ kind: 'qa', label, answer });
  }
  return blocks;
}

interface Style {
  title: (s: string) => string;
  heading: (s: string) => string;
  label: (s: string) => string;
  bullet: string;
  /**
   * Applied to every piece of user text (title, headings, labels, answers); `lineStart` tells
   * whether the text starts a line of the output.
   */
  text: (s: string, lineStart: boolean) => string;
}

const PLAIN_STYLES: Record<Exclude<OutputFormat, 'html'>, Style> = {
  text: { title: (s) => s, heading: (s) => s, label: (s) => s, bullet: '- ', text: (s) => s },
  markdown: {
    title: (s) => `# ${escapeClosingHashes(s)}`,
    heading: (s) => `## ${escapeClosingHashes(s)}`,
    label: (s) => `**${s}**`,
    bullet: '- ',
    text: escapeMarkdown,
  },
  // WhatsApp: *bold* for title, section headings and questions; bullets are "- ". WhatsApp has
  // no escaping, so user text stays as it is; it is trimmed (toBlocks/formatEntry) because
  // "* x*" would not render bold.
  whatsapp: {
    title: (s) => `*${s}*`,
    heading: (s) => `*${s}*`,
    label: (s) => `*${s}*`,
    bullet: '- ',
    text: (s) => s,
  },
};

function renderPlain(title: string, blocks: Block[], style: Style): string {
  const { text } = style;
  // Labels follow "**" on their line; title, headings and list items are escaped like line starts.
  const parts: string[] = [style.title(text(title, true))];
  for (const b of blocks) {
    if (b.kind === 'heading') {
      parts.push(style.heading(text(b.text, true)));
      continue;
    }
    const label = b.label ? style.label(text(b.label, false)) : undefined;
    if (Array.isArray(b.answer)) {
      const list = b.answer.map((a) => `${style.bullet}${text(a, true)}`).join('\n');
      parts.push(label ? `${label}\n${list}` : list);
    } else if (!label) {
      parts.push(text(b.answer, true));
    } else if (b.answer.includes('\n')) {
      parts.push(`${label}\n${text(b.answer, true)}`);
    } else {
      parts.push(`${label}: ${text(b.answer, false)}`);
    }
  }
  return parts.join('\n\n');
}

function renderHtml(title: string, blocks: Block[]): string {
  const multiline = (s: string): string => escapeHtml(s).replace(/\r?\n/g, '<br>');
  const parts: string[] = [`<h1>${escapeHtml(title)}</h1>`];
  for (const b of blocks) {
    if (b.kind === 'heading') {
      parts.push(`<h2>${escapeHtml(b.text)}</h2>`);
      continue;
    }
    const label = b.label ? `<strong>${escapeHtml(b.label)}</strong>` : undefined;
    if (Array.isArray(b.answer)) {
      const ul = `<ul>${b.answer.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>`;
      parts.push(label ? `<p>${label}</p>\n${ul}` : ul);
    } else {
      const answer = multiline(b.answer);
      parts.push(label ? `<p>${label}<br>${answer}</p>` : `<p>${answer}</p>`);
    }
  }
  return parts.join('\n');
}

/**
 * Renders an entry for copy/share. `labels` are fallbacks for yes/no fields
 * whose own `yesLabel`/`noLabel` is empty.
 */
export function formatEntry(
  form: Form,
  answers: Answers,
  format: OutputFormat,
  lang: Language,
  labels: { yes: string; no: string },
): string {
  const blocks = toBlocks(form, answers, lang, labels);
  const title = form.title.trim();
  if (format === 'html') return renderHtml(title, blocks);
  return renderPlain(title, blocks, PLAIN_STYLES[format]);
}
