import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { partNumbers, type PageDescriptor } from '../lib/pageModel';
import type { LoadedDoc } from '../lib/pdfRender';
import PageThumb from './PageThumb';

interface Props {
  pages: PageDescriptor[];
  docs: Map<string, LoadedDoc>;
  selected: Set<string>;
  splitMarks: Set<string>;
  onReorder: (from: number, to: number) => void;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onRotate: (id: string, delta: 90 | -90) => void;
  onDelete: (id: string) => void;
  onToggleSplit: (id: string) => void;
  onOpenPreview: (id: string) => void;
  onClearSelection: () => void;
}

export default function ThumbnailGrid({
  pages,
  docs,
  selected,
  splitMarks,
  onReorder,
  onSelect,
  onRotate,
  onDelete,
  onToggleSplit,
  onOpenPreview,
  onClearSelection,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const parts = partNumbers(pages, splitMarks);
  const showParts = splitMarks.size > 0;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = pages.findIndex((p) => p.id === active.id);
    const to = pages.findIndex((p) => p.id === over.id);
    if (from >= 0 && to >= 0) onReorder(from, to);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
        <div
          className="grid"
          role="list"
          aria-label="Pages"
          onClick={(e) => {
            // Clicking the grid background (not a card) clears the selection.
            if (e.target === e.currentTarget) onClearSelection();
          }}
        >
          {pages.map((page) => (
            <PageThumb
              key={page.id}
              page={page}
              partNumber={parts.get(page.id) ?? 1}
              showParts={showParts}
              doc={docs.get(page.docId)}
              selected={selected.has(page.id)}
              splitMark={splitMarks.has(page.id)}
              onSelect={onSelect}
              onRotate={onRotate}
              onDelete={onDelete}
              onToggleSplit={onToggleSplit}
              onOpenPreview={onOpenPreview}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
