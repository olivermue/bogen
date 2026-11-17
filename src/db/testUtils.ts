import type { Form } from '../schema/form';

export function makeForm(overrides: Partial<Form> = {}): Form {
  return {
    id: 'form-1',
    title: 'Test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    fields: [
      { id: 'f1', type: 'textLine', label: 'Name', required: false } as Form['fields'][number],
    ],
    ...overrides,
  };
}
