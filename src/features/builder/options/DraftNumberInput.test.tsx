import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Language } from '../../../i18n/detect';
import { renderWithProviders } from '../../../test/render';
import { DraftNumberInput } from './DraftNumberInput';

function Harness(props: {
  initial?: number;
  allowEmpty?: boolean;
  onCommit: (v: number | undefined) => void;
}) {
  const [value, setValue] = useState(props.initial);
  return (
    <DraftNumberInput
      label="Wert"
      value={value}
      allowEmpty={props.allowEmpty}
      onCommit={(v) => {
        setValue(v);
        props.onCommit(v);
      }}
    />
  );
}

function setup(language: Language, props: { initial?: number; allowEmpty?: boolean } = {}) {
  const onCommit = vi.fn<(v: number | undefined) => void>();
  renderWithProviders(<Harness {...props} onCommit={onCommit} />, { language });
  return { onCommit, input: screen.getByLabelText('Wert') };
}

describe('DraftNumberInput', () => {
  it('reads a decimal comma in German', async () => {
    const { onCommit, input } = setup('de');
    await userEvent.type(input, '2,5');
    expect(onCommit).toHaveBeenLastCalledWith(2.5);
    expect(input).toHaveValue('2,5');
  });

  it('reads a decimal point in English', async () => {
    const { onCommit, input } = setup('en');
    await userEvent.type(input, '2.5');
    expect(onCommit).toHaveBeenLastCalledWith(2.5);
    expect(input).toHaveValue('2.5');
  });

  it('shows the last valid value again on blur after partial input', async () => {
    const { onCommit, input } = setup('de', { initial: 4 });
    await userEvent.tripleClick(input);
    await userEvent.keyboard('-');
    expect(input).toHaveValue('-');
    await userEvent.tab();
    expect(input).toHaveValue('4');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('shows the committed number on blur when emptying is not allowed', async () => {
    const { onCommit, input } = setup('de', { initial: 3, allowEmpty: false });
    await userEvent.clear(input);
    await userEvent.tab();
    expect(input).toHaveValue('3');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('stays empty on blur when emptying is allowed', async () => {
    const { onCommit, input } = setup('de', { initial: 3 });
    await userEvent.clear(input);
    await userEvent.tab();
    expect(input).toHaveValue('');
    expect(onCommit).toHaveBeenLastCalledWith(undefined);
  });
});
