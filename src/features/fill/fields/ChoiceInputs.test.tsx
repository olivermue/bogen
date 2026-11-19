import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AnswerValue, Field } from '../../../schema/form';
import { renderWithProviders } from '../../../test/render';
import { FieldInput } from './FieldInput';

const choices = [
  { id: 'a', label: 'Rot' },
  { id: 'b', label: 'Grün' },
  { id: 'c', label: 'Blau' },
];

function Harness(props: { field: Field; error?: string; onChange: (v: AnswerValue) => void }) {
  const [value, setValue] = useState<AnswerValue | undefined>(undefined);
  return (
    <FieldInput
      field={props.field}
      value={value}
      error={props.error}
      onChange={(v) => {
        setValue(v);
        props.onChange(v);
      }}
    />
  );
}

function setup(field: Field, error?: string) {
  const onChange = vi.fn<(v: AnswerValue) => void>();
  renderWithProviders(<Harness field={field} error={error} onChange={onChange} />);
  return onChange;
}

const single = (display: 'radio' | 'chips'): Field => ({
  id: 's',
  type: 'singleChoice',
  label: 'Farbe',
  help: 'Lieblingsfarbe',
  required: true,
  options: { display, choices },
});

const multiple = (display: 'checkbox' | 'chips'): Field => ({
  id: 'm',
  type: 'multipleChoice',
  label: 'Farben',
  help: 'Alle passenden',
  required: false,
  options: { display, choices },
});

describe.each(['radio', 'chips'] as const)('single choice (%s)', (display) => {
  it('names the radiogroup by its label and links the help text', () => {
    setup(single(display));
    const group = screen.getByRole('radiogroup', { name: 'Farbe' });
    expect(group).toHaveAccessibleDescription('Lieblingsfarbe');
    expect(group).not.toHaveAttribute('aria-invalid');
    expect(group).toHaveAttribute('aria-required', 'true');
  });

  it('marks the group invalid and describes it with the error', () => {
    setup(single(display), 'Bitte ausfüllen.');
    const group = screen.getByRole('radiogroup', { name: 'Farbe' });
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAccessibleDescription(/Bitte ausfüllen\./);
    expect(group).toHaveAccessibleDescription(/Lieblingsfarbe/);
  });

  it('moves and selects with the arrow keys like a radio group', async () => {
    const onChange = setup(single(display));
    const radios = screen.getAllByRole('radio');
    expect(new Set(radios.map((r) => r.getAttribute('name'))).size).toBe(1);
    await userEvent.click(screen.getByRole('radio', { name: 'Rot' }));
    expect(onChange).toHaveBeenLastCalledWith('a');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Grün' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Grün' })).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith('b');
  });
});

describe.each(['checkbox', 'chips'] as const)('multiple choice (%s)', (display) => {
  it('names the group by its label, links help and error', () => {
    setup(multiple(display), 'Bitte mindestens 2 auswählen.');
    const group = screen.getByRole('group', { name: 'Farben' });
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAccessibleDescription(/Bitte mindestens 2 auswählen\./);
    expect(group).toHaveAccessibleDescription(/Alle passenden/);
  });

  it('stores the picked ids in option order', async () => {
    const onChange = setup(multiple(display));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Blau' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Rot' }));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'c']);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Blau' }));
    expect(onChange).toHaveBeenLastCalledWith(['a']);
  });
});

describe('yes/no', () => {
  it('is a radiogroup named by its label, invalid with an error', async () => {
    const onChange = setup(
      {
        id: 'y',
        type: 'yesNo',
        label: 'Einverstanden',
        required: true,
        options: { yesLabel: 'Ja', noLabel: 'Nein' },
      },
      'Bitte ausfüllen.',
    );
    const group = screen.getByRole('radiogroup', { name: 'Einverstanden' });
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAccessibleDescription('Bitte ausfüllen.');
    await userEvent.click(screen.getByRole('radio', { name: 'Nein' }));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  const yesNo = (display?: 'radio' | 'dropdown' | 'chips'): Field => ({
    id: 'y',
    type: 'yesNo',
    label: 'Einverstanden',
    required: false,
    options: { yesLabel: 'Klar', noLabel: 'Lieber nicht', ...(display && { display }) },
  });

  it('shows chips as a radiogroup and answers true/false', async () => {
    const onChange = setup(yesNo('chips'));
    expect(screen.getByRole('radiogroup', { name: 'Einverstanden' })).toBeInTheDocument();
    expect(document.querySelectorAll('.mantine-Chip-root')).toHaveLength(2);
    await userEvent.click(screen.getByRole('radio', { name: 'Klar' }));
    expect(onChange).toHaveBeenLastCalledWith(true);
    await userEvent.click(screen.getByRole('radio', { name: 'Lieber nicht' }));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('shows a dropdown and answers true/false/null', async () => {
    const onChange = setup(yesNo('dropdown'));
    const select = screen.getByRole('combobox', { name: 'Einverstanden' });
    await userEvent.selectOptions(select, 'Klar');
    expect(onChange).toHaveBeenLastCalledWith(true);
    await userEvent.selectOptions(select, 'Lieber nicht');
    expect(onChange).toHaveBeenLastCalledWith(false);
    await userEvent.selectOptions(select, 'Bitte wählen');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('shows radios when no display is set (older forms)', () => {
    setup(yesNo());
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(document.querySelectorAll('.mantine-Chip-root')).toHaveLength(0);
  });
});
