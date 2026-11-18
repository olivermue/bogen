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
  /**
   * Line break between two text lines of one block. Markdown needs a hard break ("\" at the
   * end of the line); a plain "\n" would join the lines into one when rendered.
   */
  lineBreak: string;
  /**
   * Markdown: text right after a list line continues the last list item ("lazy continuation"),
   * so a list followed by an unlabeled text block still needs a blank line.
   */
  blankAfterList: boolean;
}

const PLAIN_STYLES: Record<Exclude<OutputFormat, 'html'>, Style> = {
  text: {
    title: (s) => s,
    heading: (s) => s,
    label: (s) => s,
    bullet: '- ',
    text: (s) => s,
    lineBreak: '\n',
    blankAfterList: false,
  },
  markdown: {
    title: (s) => `# ${escapeClosingHashes(s)}`,
    heading: (s) => `## ${escapeClosingHashes(s)}`,
    label: (s) => `**${s}**`,
    bullet: '- ',
    text: escapeMarkdown,
    lineBreak: '\\\n',
    blankAfterList: true,
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
    lineBreak: '\n',
    blankAfterList: false,
  },
};

/**
 * Joins text lines with `lineBreak`; around an empty line (a paragraph break inside a
 * multi-line answer) a plain "\n" is used, so no stray "\" lines appear in Markdown.
 */
function joinLines(lines: string[], lineBreak: string): string {
  let out = lines[0] ?? '';
  for (let i = 1; i < lines.length; i++) {
    const hard = lines[i - 1] !== '' && lines[i] !== '';
    out += (hard ? lineBreak : '\n') + lines[i];
  }
  return out;
}

/** One rendered block plus what the separator to its neighbours depends on. */
interface Part {
  body: string;
  /** An answer without label: it joins a directly preceding one without a blank line. */
  unlabeled: boolean;
  isList: boolean;
}

/**
 * Layout: title, then the blocks, separated by a blank line. A block with a label puts the label
 * on its own line and the answer (one line per value) right below. Only between two blocks
 * without label there is no blank line: they follow each other line by line.
 */
function renderPlain(title: string, blocks: Block[], style: Style): string {
  const { text, lineBreak } = style;
  const lines = (s: string): string => joinLines(text(s, true).split(/\r?\n/), lineBreak);
  // Labels follow "**" on their line; title, headings, answers and list items are escaped like
  // line starts.
  const parts: Part[] = [{ body: style.title(text(title, true)), unlabeled: false, isList: false }];
  for (const b of blocks) {
    if (b.kind === 'heading') {
      parts.push({ body: style.heading(text(b.text, true)), unlabeled: false, isList: false });
      continue;
    }
    const isList = Array.isArray(b.answer);
    const answer = Array.isArray(b.answer)
      ? b.answer.map((a) => `${style.bullet}${text(a, true)}`).join('\n')
      : lines(b.answer);
    if (!b.label) {
      parts.push({ body: answer, unlabeled: true, isList });
      continue;
    }
    // A list starts its own Markdown block, so no hard break before it.
    const label = style.label(text(b.label, false));
    parts.push({ body: label + (isList ? '\n' : lineBreak) + answer, unlabeled: false, isList });
  }

  let out = '';
  parts.forEach((cur, i) => {
    const prev = parts[i - 1];
    if (prev) {
      let sep = '\n\n';
      if (prev.unlabeled && cur.unlabeled) {
        if (prev.isList && !cur.isList && style.blankAfterList) sep = '\n\n';
        else if (prev.isList || cur.isList) sep = '\n';
        else sep = lineBreak;
      }
      out += sep;
    }
    out += cur.body;
  });
  return out;
}

/** Same grouping as `renderPlain`: consecutive unlabeled text answers share one paragraph. */
function renderHtml(title: string, blocks: Block[]): string {
  const multiline = (s: string): string => escapeHtml(s).replace(/\r?\n/g, '<br>');
  const parts: string[] = [`<h1>${escapeHtml(title)}</h1>`];
  // Index in `parts` of the paragraph an unlabeled text answer may join, or -1.
  let openParagraph = -1;
  for (const b of blocks) {
    const joinable = openParagraph;
    openParagraph = -1;
    if (b.kind === 'heading') {
      parts.push(`<h2>${escapeHtml(b.text)}</h2>`);
      continue;
    }
    const label = b.label ? `<strong>${escapeHtml(b.label)}</strong>` : undefined;
    if (Array.isArray(b.answer)) {
      const ul = `<ul>${b.answer.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>`;
      parts.push(label ? `<p>${label}</p>\n${ul}` : ul);
      continue;
    }
    const answer = multiline(b.answer);
    if (label) {
      parts.push(`<p>${label}<br>${answer}</p>`);
    } else if (joinable >= 0) {
      parts[joinable] = parts[joinable]!.replace(/<\/p>$/, `<br>${answer}</p>`);
      openParagraph = joinable;
    } else {
      parts.push(`<p>${answer}</p>`);
      openParagraph = parts.length - 1;
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
