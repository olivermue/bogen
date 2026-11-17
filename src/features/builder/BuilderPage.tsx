import {
  Button,
  Group,
  Menu,
  Modal,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router';
import { getForm, saveForm } from '../../db/forms';
import { registerUnsavedWork } from '../../pwa/pendingWrites';
import type { MessageKey } from '../../i18n/de';
import { useT } from '../../i18n/I18nProvider';
import { FIELD_TYPES, type Field, type Form } from '../../schema/form';
import { FormFields } from '../fill/fields/FieldInput';
import { prefillAnswers } from '../fill/prefill';
import { FieldList } from './FieldList';
import { duplicateField, moveField, newField } from './newField';
import { validateForm, type ValidationResult } from './validate';

function blankForm(): Form {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title: '', createdAt: now, updatedAt: now, fields: [] };
}

/** The editable part of a form; used for the unsaved-changes comparison. */
const snapshot = (title: string, description: string, fields: Field[]) =>
  JSON.stringify({ title, description, fields });

function BuilderForm(props: { initial: Form }) {
  const t = useT();
  const navigate = useNavigate();
  const { initial } = props;
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? '');
  const [fields, setFields] = useState<Field[]>(initial.fields);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [baseline] = useState(() =>
    snapshot(initial.title, initial.description ?? '', initial.fields),
  );
  const saved = useRef(false);

  const dirty = snapshot(title, description, fields) !== baseline;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !saved.current && currentLocation.pathname !== nextLocation.pathname,
  );

  // Unsaved changes: the browser asks before closing/reloading the tab, and an app update in
  // another tab does not reload this one (see src/pwa/updateState.ts).
  useEffect(() => {
    if (!dirty) return;
    const release = registerUnsavedWork();
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (saved.current) return;
      event.preventDefault();
      event.returnValue = ''; // older browsers need it set to show the prompt
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      release();
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [dirty]);

  const changeFields = (next: Field[]) => {
    setFields(next);
    setValidation(null); // indexes may have shifted
  };

  const addField = (type: (typeof FIELD_TYPES)[number]) => {
    const field = newField(type, t);
    changeFields([...fields, field]);
    setExpanded((prev) => new Set(prev).add(field.id));
  };

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const updateField = (index: number, field: Field) => {
    setFields((prev) => prev.map((f, i) => (i === index ? field : f)));
    setValidation((prev) => {
      if (!prev?.fieldErrors.has(index)) return prev;
      const fieldErrors = new Map(prev.fieldErrors);
      fieldErrors.delete(index);
      return { ...prev, fieldErrors };
    });
  };

  const duplicate = (index: number) => {
    const source = fields[index];
    if (!source) return;
    const copy = duplicateField(source);
    changeFields([...fields.slice(0, index + 1), copy, ...fields.slice(index + 1)]);
    setExpanded((prev) => new Set(prev).add(copy.id));
  };

  const save = async () => {
    const form: Form = {
      ...initial,
      title: title.trim(),
      description: description.trim() === '' ? undefined : description,
      fields,
    };
    const result = validateForm(form, t);
    setValidation(result);
    if (!result.ok) {
      setPreview(false); // errors are shown in the editor
      setExpanded(
        (prev) =>
          new Set([...prev, ...[...result.fieldErrors.keys()].flatMap((i) => fields[i]?.id ?? [])]),
      );
      notifications.show({ color: 'red', message: t('builder.error.notification') });
      return;
    }
    setSaving(true);
    try {
      await saveForm(form);
      // Mark before navigating so the blocker lets this navigation through.
      saved.current = true;
      notifications.show({ color: 'green', message: t('builder.saved') });
      // After saving, return to the form list (new and existing forms alike).
      await navigate('/forms');
    } catch {
      saved.current = false;
      notifications.show({ color: 'red', message: t('builder.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="md" maw={800}>
      <Button
        variant="subtle"
        w="fit-content"
        ml="calc(var(--mantine-spacing-xs) * -1)"
        leftSection={<span aria-hidden>{'‹'}</span>}
        onClick={() => void navigate('/forms')}
      >
        {t('nav.back')}
      </Button>
      <Switch
        label={t('builder.preview')}
        checked={preview}
        onChange={(e) => setPreview(e.currentTarget.checked)}
      />
      {preview ? (
        <FormPreview title={title} description={description} fields={fields} />
      ) : (
        <>
          <TextInput
            label={t('builder.formTitle')}
            withAsterisk
            value={title}
            error={validation?.titleError}
            onChange={(e) => {
              setTitle(e.currentTarget.value);
              setValidation((prev) => (prev ? { ...prev, titleError: undefined } : prev));
            }}
          />
          <Textarea
            label={t('builder.formDescription')}
            autosize
            minRows={2}
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />
          {validation?.otherErrors.map((message) => (
            <Text key={message} c="red" size="sm" role="alert">
              {message}
            </Text>
          ))}

          {fields.length === 0 && (
            <Text c="dimmed" size="sm">
              {t('builder.noFields')}
            </Text>
          )}
          <FieldList
            fields={fields}
            expanded={expanded}
            errors={validation?.fieldErrors ?? new Map()}
            onToggle={toggle}
            onChange={updateField}
            onMove={(from, to) => changeFields(moveField(fields, from, to))}
            onDuplicate={duplicate}
            onDelete={(index) => changeFields(fields.filter((_, i) => i !== index))}
          />
        </>
      )}

      <Group justify="space-between">
        {/* hideDetached off: floating-ui's hide middleware wrongly hides the menu in jsdom (all rects are 0). */}
        {preview ? (
          <span />
        ) : (
          <Menu position="bottom-start" withinPortal hideDetached={false}>
            <Menu.Target>
              <Button variant="light">{t('builder.addField')}</Button>
            </Menu.Target>
            <Menu.Dropdown>
              {FIELD_TYPES.map((type) => (
                <Menu.Item key={type} onClick={() => addField(type)}>
                  {t(`builder.fieldType.${type}` as MessageKey)}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        )}
        <Group>
          <Button variant="default" onClick={() => void navigate('/forms')}>
            {t('builder.cancel')}
          </Button>
          <Button loading={saving} onClick={() => void save()}>
            {t('builder.save')}
          </Button>
        </Group>
      </Group>

      <Modal
        opened={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        title={t('builder.leave.title')}
      >
        <Text>{t('builder.leave.text')}</Text>
        <Group mt="md" justify="flex-end">
          <Button variant="default" onClick={() => blocker.reset?.()}>
            {t('builder.leave.stay')}
          </Button>
          <Button color="red" onClick={() => blocker.proceed?.()}>
            {t('builder.leave.discard')}
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}

/**
 * Read-only rendering of the unsaved form with the fill components (disabled).
 * Saves nothing and creates no entry.
 */
function FormPreview(props: { title: string; description: string; fields: Field[] }) {
  const t = useT();
  const { title, description, fields } = props;
  const form: Form = { id: 'preview', title, createdAt: '', updatedAt: '', fields };
  const answers = prefillAnswers(form, {}) ?? {};
  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{title}</Title>
        {description.trim() !== '' && (
          <Text c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
            {description}
          </Text>
        )}
      </div>
      {fields.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('builder.preview.empty')}
        </Text>
      ) : (
        <FormFields fields={fields} answers={answers} disabled />
      )}
    </Stack>
  );
}

/** Lazy route: `/forms/new` and `/forms/:formId/edit`. */
export function BuilderPage() {
  const t = useT();
  const { formId } = useParams();
  const [blank] = useState(blankForm);
  const [loaded, setLoaded] = useState<{ id: string; form: Form | undefined } | null>(null);

  useEffect(() => {
    if (!formId) return;
    let active = true;
    void getForm(formId).then((form) => {
      if (active) setLoaded({ id: formId, form });
    });
    return () => {
      active = false;
    };
  }, [formId]);

  if (!formId) return <BuilderForm key={blank.id} initial={blank} />;
  if (loaded?.id !== formId) return <Text c="dimmed">{t('builder.loading')}</Text>;
  if (!loaded.form) return <Text>{t('builder.notFound')}</Text>;
  return <BuilderForm key={loaded.form.id} initial={loaded.form} />;
}
