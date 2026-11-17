import { describe, expect, it } from 'vitest';
import { de } from '../../i18n/de';
import { en } from '../../i18n/en';
import { FIELD_TYPES, fieldSchema, type Field } from '../../schema/form';
import { moveField, newField } from './newField';

const tDe = (k: keyof typeof de) => de[k];
const tEn = (k: keyof typeof en) => en[k];

describe('newField', () => {
  it('uses the UI language for yes/no labels', () => {
    expect(newField('yesNo', tDe).options).toEqual({ yesLabel: 'Ja', noLabel: 'Nein' });
    expect(newField('yesNo', tEn).options).toEqual({ yesLabel: 'Yes', noLabel: 'No' });
  });

  it('creates valid fields of every type with unique ids, not required', () => {
    const ids = new Set<string>();
    for (const type of FIELD_TYPES) {
      const field = newField(type, tDe);
      expect(field.type).toBe(type);
      expect(field.required).toBe(false);
      expect(fieldSchema.safeParse(field).success).toBe(true);
      ids.add(field.id);
    }
    expect(ids.size).toBe(FIELD_TYPES.length);
  });

  it('gives choice fields two options; single choice is radio', () => {
    const single = newField('singleChoice', tDe);
    const multi = newField('multipleChoice', tDe);
    if (single.type !== 'singleChoice' || multi.type !== 'multipleChoice') throw new Error();
    expect(single.options.choices.map((c) => c.label)).toEqual(['Option 1', 'Option 2']);
    expect(single.options.display).toBe('radio');
    expect(multi.options.choices).toHaveLength(2);
    expect(new Set(single.options.choices.map((c) => c.id)).size).toBe(2);
  });
});

describe('moveField', () => {
  const f = (id: string): Field => ({ id, type: 'textLine', required: false, options: {} });
  const ids = (fields: Field[]) => fields.map((x) => x.id);

  it('moves forward and backward without mutating', () => {
    const list = [f('a'), f('b'), f('c')];
    expect(ids(moveField(list, 0, 2))).toEqual(['b', 'c', 'a']);
    expect(ids(moveField(list, 2, 0))).toEqual(['c', 'a', 'b']);
    expect(ids(list)).toEqual(['a', 'b', 'c']);
  });

  it('ignores out-of-range targets', () => {
    const list = [f('a'), f('b')];
    expect(ids(moveField(list, 0, -1))).toEqual(['a', 'b']);
    expect(ids(moveField(list, 1, 2))).toEqual(['a', 'b']);
  });
});
