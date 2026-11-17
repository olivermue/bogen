import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ActionIcon, Stack } from '@mantine/core';
import { useT } from '../../i18n/I18nProvider';
import type { Field } from '../../schema/form';
import { FieldEditor } from './FieldEditor';

interface ItemProps {
  field: Field;
  index: number;
  count: number;
  expanded: boolean;
  errors: string[];
  onToggle: () => void;
  onChange: (field: Field) => void;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function SortableField(props: ItemProps) {
  const t = useT();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props.field.id,
    attributes: { roleDescription: t('builder.dnd.roleDescription') },
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: 'relative',
        zIndex: isDragging ? 1 : undefined,
        opacity: isDragging ? 0.8 : undefined,
      }}
    >
      <FieldEditor
        {...props}
        handle={(name) => (
          <ActionIcon
            ref={setActivatorNodeRef}
            variant="subtle"
            color="gray"
            aria-label={t('builder.field.drag', { name })}
            style={{ touchAction: 'none', cursor: 'grab' }}
            {...attributes}
            {...listeners}
          >
            ⠿
          </ActionIcon>
        )}
      />
    </div>
  );
}

/** Sortable list of field editors (drag handle + keyboard + per-card up/down buttons). */
export function FieldList(props: {
  fields: Field[];
  expanded: ReadonlySet<string>;
  errors: ReadonlyMap<number, string[]>;
  onToggle: (id: string) => void;
  onChange: (index: number, field: Field) => void;
  onMove: (from: number, to: number) => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  const t = useT();
  const { fields } = props;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const position = (id: string | number) => fields.findIndex((f) => f.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('builder.dnd.pickedUp', { n: position(active.id) }),
    onDragOver: ({ over }) =>
      over ? t('builder.dnd.movedTo', { n: position(over.id) }) : undefined,
    onDragEnd: ({ over, active }) =>
      t('builder.dnd.dropped', { n: position(over?.id ?? active.id) }),
    onDragCancel: () => t('builder.dnd.cancelled'),
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = fields.findIndex((f) => f.id === active.id);
    const to = fields.findIndex((f) => f.id === over.id);
    if (from >= 0 && to >= 0) props.onMove(from, to);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t('builder.dnd.instructions') },
      }}
    >
      <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
        <Stack gap="sm">
          {fields.map((field, index) => (
            <SortableField
              key={field.id}
              field={field}
              index={index}
              count={fields.length}
              expanded={props.expanded.has(field.id)}
              errors={props.errors.get(index) ?? []}
              onToggle={() => props.onToggle(field.id)}
              onChange={(next) => props.onChange(index, next)}
              onMove={(to) => props.onMove(index, to)}
              onDuplicate={() => props.onDuplicate(index)}
              onDelete={() => props.onDelete(index)}
            />
          ))}
        </Stack>
      </SortableContext>
    </DndContext>
  );
}
