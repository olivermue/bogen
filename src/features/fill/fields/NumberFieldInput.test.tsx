import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Language } from '../../../i18n/detect';
import type { AnswerValue, NumberField } from '../../../schema/form';
import { renderWithProviders } from '../../../test/render';
import { NumberFieldInput } from './NumberFieldInput';

const field: NumberField = {
  id: 'n',
  type: 'number',
  label: 'Gewicht',
  required: false,
  options: {},
};

function Harness(props: { initial?: AnswerValue; onChange: (v: AnswerValue) => void }) {
  const [value, setValue] = useState<AnswerValue | undefined>(props.initial);
  return (
    <NumberFieldInput
      field={field}
      value={value}
      onChange={(v) => {
        setValue(v);
        props.onChange(v);
      }}
    />
  );
}

function setup(language: Language, initial?: AnswerValue) {
  const onChange = vi.fn<(v: AnswerValue) => void>();
  renderWithProviders(<Harness initial={initial} onChange={onChange} />, { language });
  return { onChange, input: screen.getByLabelText('Gewicht') };
}

describe('NumberFieldInput', () => {
  it('stores "2,5" as 2.5 in German', async () => {
    const { onChange, input } = setup('de');
    await userEvent.type(input, '2,5');
    expect(onChange).toHaveBeenLastCalledWith(2.5);
    expect(input).toHaveValue('2,5');
  });

  it('stores "2.5" as 2.5 in English', async () => {
    const { onChange, input } = setup('en');
    await userEvent.type(input, '2.5');
    expect(onChange).toHaveBeenLastCalledWith(2.5);
    expect(input).toHaveValue('2.5');
  });

  it('shows a stored decimal with the separator of the language', () => {
    setup('de', 1.5);
    expect(screen.getByLabelText('Gewicht')).toHaveValue('1,5');
  });

  it('keeps the previous answer for "-" typed over a selection and shows it again on blur', async () => {
    const { onChange, input } = setup('de', 7);
    await userEvent.tripleClick(input);
    await userEvent.keyboard('-');
    expect(input).toHaveValue('-');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(input).toHaveValue('7');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stores null when emptied', async () => {
    const { onChange, input } = setup('de', 7);
    await userEvent.clear(input);
    await userEvent.tab();
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(input).toHaveValue('');
  });
});
