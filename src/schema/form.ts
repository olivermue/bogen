import { z } from 'zod';

export const FIELD_TYPES = [
  'textLine',
  'textArea',
  'singleChoice',
  'multipleChoice',
  'date',
  'time',
  'number',
  'yesNo',
  'heading',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/**
 * Upper bounds, so that a schema-valid file (import, library) can never make the page hang or
 * render absurd amounts (e.g. 10^9 textarea rows). Generous for real forms. Added after release
 * of schemaVersion 1 as a pure restriction: the version stays 1.
 */
export const LIMITS = {
  idLength: 200,
  shortText: 1_000,
  longText: 20_000,
  fields: 500,
  choices: 200,
  maxLength: 100_000,
  rows: 50,
  relativeDays: 3_650,
  stepMinutes: 720,
} as const;

const id = z.string().min(1).max(LIMITS.idLength);
const shortText = z.string().max(LIMITS.shortText);
const longText = z.string().max(LIMITS.longText);

/** Strict `YYYY-MM-DD` that must be a real calendar date. */
const isoDate = z.string().refine((value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}, 'Invalid calendar date, expected YYYY-MM-DD');

/** `HH:mm`, 00:00 to 23:59. */
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time, expected HH:mm');

const dateBoundSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixed'), date: isoDate }),
  z.object({
    kind: z.literal('relative'),
    days: z.number().int().min(-LIMITS.relativeDays).max(LIMITS.relativeDays),
  }),
]);
export type DateBound = z.infer<typeof dateBoundSchema>;

const choiceOptionSchema = z.object({ id, label: shortText });
export type ChoiceOption = z.infer<typeof choiceOptionSchema>;

const choices = z.array(choiceOptionSchema).min(1).max(LIMITS.choices);

/** Adds an issue per repeated option id. */
function uniqueChoiceIds(value: { choices: ChoiceOption[] }, ctx: z.RefinementCtx): void {
  const seen = new Set<string>();
  value.choices.forEach((choice, i) => {
    if (seen.has(choice.id)) {
      ctx.addIssue({
        code: 'custom',
        message: `Duplicate choice id "${choice.id}"`,
        path: ['choices', i, 'id'],
      });
    }
    seen.add(choice.id);
  });
}

const common = {
  id,
  label: shortText.optional(),
  required: z.boolean(),
  help: longText.optional(),
};

const textLineField = z.object({
  ...common,
  type: z.literal('textLine'),
  options: z.object({
    placeholder: shortText.optional(),
    maxLength: z.number().int().positive().max(LIMITS.maxLength).optional(),
  }),
});

const textAreaField = z.object({
  ...common,
  type: z.literal('textArea'),
  options: z.object({
    placeholder: shortText.optional(),
    maxLength: z.number().int().positive().max(LIMITS.maxLength).optional(),
    rows: z.number().int().positive().max(LIMITS.rows).optional(),
  }),
});

/** How a single answer out of a few is shown: single choice and yes/no. */
const singleDisplay = z.enum(['radio', 'dropdown', 'chips']);

const singleChoiceField = z.object({
  ...common,
  type: z.literal('singleChoice'),
  options: z.object({ choices, display: singleDisplay }).superRefine(uniqueChoiceIds),
});

const multipleChoiceField = z.object({
  ...common,
  type: z.literal('multipleChoice'),
  options: z
    .object({
      choices,
      /** Optional; absent means `'checkbox'`. */
      display: z.enum(['checkbox', 'chips']).optional(),
      minSelected: z.number().int().min(0).max(LIMITS.choices).optional(),
      maxSelected: z.number().int().min(0).max(LIMITS.choices).optional(),
    })
    .superRefine((value, ctx) => {
      uniqueChoiceIds(value, ctx);
      if (
        value.minSelected !== undefined &&
        value.maxSelected !== undefined &&
        value.minSelected > value.maxSelected
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'minSelected must not exceed maxSelected',
          path: ['minSelected'],
        });
      }
    }),
});

const dateField = z.object({
  ...common,
  type: z.literal('date'),
  options: z.object({
    min: dateBoundSchema.optional(),
    max: dateBoundSchema.optional(),
    /** 0 = Sunday ... 6 = Saturday */
    disabledWeekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    defaultToday: z.boolean().optional(),
  }),
});

const timeField = z.object({
  ...common,
  type: z.literal('time'),
  options: z.object({
    min: hhmm.optional(),
    max: hhmm.optional(),
    stepMinutes: z.number().int().min(1).max(LIMITS.stepMinutes).optional(),
  }),
});

const numberField = z.object({
  ...common,
  type: z.literal('number'),
  options: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    unit: shortText.optional(),
  }),
});

const yesNoField = z.object({
  ...common,
  type: z.literal('yesNo'),
  // display was added later; optional so older files stay valid. Missing means 'radio'.
  options: z.object({ yesLabel: shortText, noLabel: shortText, display: singleDisplay.optional() }),
});

// A heading has no label: its text is options.text. A label in older files is dropped on parse.
const headingField = z.object({
  id: common.id,
  help: common.help,
  type: z.literal('heading'),
  required: z.literal(false),
  options: z.object({ text: longText }),
});

export const fieldSchema = z.discriminatedUnion('type', [
  textLineField,
  textAreaField,
  singleChoiceField,
  multipleChoiceField,
  dateField,
  timeField,
  numberField,
  yesNoField,
  headingField,
]);

export type TextLineField = z.infer<typeof textLineField>;
export type TextAreaField = z.infer<typeof textAreaField>;
export type SingleChoiceField = z.infer<typeof singleChoiceField>;
export type MultipleChoiceField = z.infer<typeof multipleChoiceField>;
export type DateField = z.infer<typeof dateField>;
export type TimeField = z.infer<typeof timeField>;
export type NumberField = z.infer<typeof numberField>;
export type YesNoField = z.infer<typeof yesNoField>;
export type HeadingField = z.infer<typeof headingField>;
export type Field = z.infer<typeof fieldSchema>;

export const formSchema = z
  .object({
    id,
    title: shortText,
    description: longText.optional(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    fields: z.array(fieldSchema).max(LIMITS.fields),
  })
  .superRefine((form, ctx) => {
    const seen = new Set<string>();
    form.fields.forEach((field, i) => {
      if (seen.has(field.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate field id "${field.id}"`,
          path: ['fields', i, 'id'],
        });
      }
      seen.add(field.id);
    });
  });
export type Form = z.infer<typeof formSchema>;

/** Answer values; choices store `ChoiceOption.id`. Dates `YYYY-MM-DD`, times `HH:mm`. */
export type AnswerValue = string | string[] | number | boolean | null;
/** Key = `Field.id`. */
export type Answers = Record<string, AnswerValue>;
