import { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RotateCw, Scissors, X, Check, ZoomIn, Crop } from './icons';
import type { PageDescriptor } from '../lib/pageModel';
import { renderThumbnail, type LoadedDoc } from '../lib/pdfRender';
import { cropFrameLayout, effectiveAspect } from '../lib/cropView';
import { usePeek } from '../hooks/usePeek';
import PagePeek from './PagePeek';

interface Props {
  page: PageDescriptor;
  partNumber: number;
  showParts: boolean;
  doc: LoadedDoc | undefined;
  selected: boolean;
  splitMark: boolean;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onRotate: (id: string, delta: 90 | -90) => void;
  onDelete: (id: string) => void;
  onToggleSplit: (id: string) => void;
  onOpenPreview: (id: string) => void;
}

const DEFAULT_ASPECT = 0.7727; // US Letter / A4 portrait, used before render

export default function PageThumb({
  page,
  partNumber,
  showParts,
  doc,
  selected,
  splitMark,
  onSelect,
  onRotate,
  onDelete,
  onToggleSplit,
  onOpenPreview,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id: page.id });

  const rootRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [aspect, setAspect] = useState(DEFAULT_ASPECT); // page width / height
  const [innerSize, setInnerSize] = useState<{ w: number; h: number } | null>(null);

  // Long-press peek (touch/pen): a larger floating preview for confirming the
  // page before/while reordering on small displays. See usePeek.
  const peek = usePeek(rootRef);

  // Combine dnd-kit's ref with our own so we can observe the DOM node.
  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    rootRef.current = node;
  };

  // Lazy: only render the thumbnail once the card scrolls near the viewport.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: '300px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [visible]);

  // Render the page (unrotated) into the canvas host once visible. Rotation and
  // crop are applied via CSS (cropFrameLayout) so they never force a re-render.
  // Cropped pages render at a higher maxEdge so the CSS zoom into the crop
  // region doesn't blur.
  const maxEdge = page.crop
    ? Math.min(520, Math.ceil(260 / Math.max(page.crop.w, page.crop.h)))
    : 260;
  useEffect(() => {
    let cancelled = false;
    if (!visible || !doc || !hostRef.current) return;
    renderThumbnail(doc, page.pageIndex, { rotation: 0, maxEdge })
      .then((canvas) => {
        if (cancelled || !hostRef.current) return;
        canvas.className = 'page-canvas';
        hostRef.current.replaceChildren(canvas);
        setAspect(canvas.width / canvas.height);
        setRendered(true);
      })
      .catch(() => hostRef.current?.replaceChildren());
    return () => {
      cancelled = true;
    };
  }, [visible, doc, page.pageIndex, maxEdge]);

  // Track the available thumb area; the frame box is derived in render so it
  // updates in the same commit as a crop/rotation change (no one-frame lag).
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const measure = () => {
      const w = inner.clientWidth;
      const h = inner.clientHeight;
      if (w && h) setInnerSize({ w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  // Letterbox the frame to the displayed (cropped-then-rotated) aspect, so the
  // card shows the page exactly as it will export.
  const frameAspect = effectiveAspect(aspect, page.crop, page.rotation);
  let box: { w: number; h: number } | null = null;
  if (innerSize) {
    let w = innerSize.w;
    let h = w / frameAspect;
    if (h > innerSize.h) {
      h = innerSize.h;
      w = h * frameAspect;
    }
    box = { w, h };
  }

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Long-press starts a peek; compose with dnd-kit's own onPointerDown so
  // dragging keeps working.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    listeners?.onPointerDown?.(e);
    peek.onPointerDown(e);
  };

  // Position the full-page element inside the clipping frame so the rotated
  // crop region fills it exactly (uncropped pages fill it edge-to-edge).
  const layout = box ? cropFrameLayout(box.w, box.h, page.crop, page.rotation) : null;
  const pageStyle: React.CSSProperties | undefined = layout
    ? {
        width: layout.w,
        height: layout.h,
        left: layout.left,
        top: layout.top,
        transform: `rotate(${page.rotation}deg)`,
      }
    : undefined;

  // dnd-kit's sortable attributes default to role="button", but the card
  // contains real buttons (rotate/split/delete/expand) — an interactive role
  // with focusable descendants is invalid (axe: nested-interactive). listitem
  // keeps the card focusable via dnd-kit's tabIndex without promising
  // Enter/Space activation it doesn't have.
  return (
    <div
      ref={setRefs}
      style={style}
      className={`card${selected ? ' selected' : ''}${isDragging ? ' dragging' : ''}${
        isOver ? ' over' : ''
      }`}
      onClick={(e) => {
        // Swallow the click that ends a long-press peek so it doesn't select.
        if (peek.consumeClickSuppression()) return;
        onSelect(page.id, e);
      }}
      onDoubleClick={() => onOpenPreview(page.id)}
      onPointerLeave={peek.onPointerLeave}
      onPointerMove={peek.onPointerMove}
      onPointerUp={peek.onPointerUp}
      onPointerCancel={peek.onPointerCancel}
      {...attributes}
      role="listitem"
      {...listeners}
      onPointerDown={onPointerDown}
    >
      <button
        className="card-expand"
        title="Preview page"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onOpenPreview(page.id);
        }}
      >
        <ZoomIn size={15} />
      </button>

      {splitMark && <span className="card-split-line" />}
      {splitMark && (
        <span className="card-split-badge">
          <Scissors size={14} />
        </span>
      )}

      {selected && (
        <span className="card-check">
          <Check size={16} />
        </span>
      )}

      <div className="card-thumb">
        <div className="card-thumb-inner" ref={innerRef}>
          <div
            className="card-frame"
            style={box ? { width: box.w, height: box.h } : undefined}
          >
            <div className="card-page" style={pageStyle}>
              <div
                className={`card-canvas-host${rendered ? '' : ' skeleton'}`}
                ref={hostRef}
              />
            </div>
          </div>
        </div>
        {page.crop && (
          <span
            className="card-crop-badge"
            title="Cropped — use “Clear crop” in the toolbar to undo"
          >
            <Crop size={13} />
          </span>
        )}
      </div>

      <div className="card-footer">
        <span className="card-label">Page {page.pageIndex + 1}</span>
        {showParts && <span className="card-part">Part {partNumber}</span>}
        <span className="card-ops" onPointerDown={(e) => e.stopPropagation()}>
          <button
            title="Rotate"
            onClick={(e) => {
              e.stopPropagation();
              onRotate(page.id, 90);
            }}
          >
            <RotateCw size={15} />
          </button>
          <button
            title={splitMark ? 'Remove split' : 'Split after this page'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSplit(page.id);
            }}
          >
            <Scissors size={15} />
          </button>
          <button
            className="op-del"
            title="Delete page"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(page.id);
            }}
          >
            <X size={15} />
          </button>
        </span>
      </div>

      {peek.peekAnchor && <PagePeek page={page} doc={doc} anchor={peek.peekAnchor} />}
    </div>
  );
}
