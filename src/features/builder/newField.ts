import type { MessageKey } from '../../i18n/de';
import type { ChoiceOption, Field, FieldType } from '../../schema/form';

type Translate = (key: MessageKey) => string;

export function newChoice(label: string): ChoiceOption {
  return { id: crypto.randomUUID(), label };
}

/**
 * A fresh field with defaults. Default texts use the current UI language and then
 * belong to the form (they are never re-translated).
 */
export function newField(type: FieldType, t: Translate): Field {
  const id = crypto.randomUUID();
  const base = { id, required: false } as const;
  const defaultChoices = () => [
    newChoice(t('builder.default.option1')),
    newChoice(t('builder.default.option2')),
  ];
  switch (type) {
    case 'textLine':
      return { ...base, type, options: {} };
    case 'textArea':
      return { ...base, type, options: {} };
    case 'singleChoice':
      return { ...base, type, options: { display: 'radio', choices: defaultChoices() } };
    case 'multipleChoice':
      return { ...base, type, options: { choices: defaultChoices() } };
    case 'date':
      return { ...base, type, options: {} };
    case 'time':
      return { ...base, type, options: {} };
    case 'number':
      return { ...base, type, options: {} };
    case 'yesNo':
      return {
        ...base,
        type,
        options: { yesLabel: t('builder.default.yes'), noLabel: t('builder.default.no') },
      };
    case 'heading':
      return { ...base, type, options: { text: '' } };
  }
}

/** Returns a copy with the item at `from` moved to `to`; out-of-range moves change nothing. */
export function moveField(fields: Field[], from: number, to: number): Field[] {
  const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < fields.length;
  if (!inRange(from) || !inRange(to) || from === to) return [...fields];
  const next = [...fields];
  const [item] = next.splice(from, 1);
  if (item) next.splice(to, 0, item);
  return next;
}

/** Copy with new ids (field and options) for "duplicate". */
export function duplicateField(field: Field): Field {
  const copy = structuredClone(field);
  copy.id = crypto.randomUUID();
  if (copy.type === 'singleChoice' || copy.type === 'multipleChoice') {
    for (const choice of copy.options.choices) choice.id = crypto.randomUUID();
  }
  return copy;
}
