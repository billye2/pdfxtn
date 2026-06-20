import { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RotateCw, Scissors, X, Check, Maximize2 } from './icons';
import type { PageDescriptor } from '../lib/pageModel';
import { renderThumbnail, type LoadedDoc } from '../lib/pdfRender';

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
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

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

  // Render the page (unrotated) into the canvas host once visible. Rotation is
  // applied via CSS transform so it animates and the crop overlay rotates with it.
  useEffect(() => {
    let cancelled = false;
    if (!visible || !doc || !hostRef.current) return;
    renderThumbnail(doc, page.pageIndex, { rotation: 0, maxEdge: 260 })
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
  }, [visible, doc, page.pageIndex]);

  // Measure the available thumb area and compute the letterboxed page box, so
  // the crop overlay can be positioned exactly over the rendered page.
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const measure = () => {
      const iw = inner.clientWidth;
      const ih = inner.clientHeight;
      if (!iw || !ih) return;
      let w = iw;
      let h = iw / aspect;
      if (h > ih) {
        h = ih;
        w = ih * aspect;
      }
      setBox({ w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [aspect]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // When rotated to a side, scale to fit (page aspect ≈ 0.78 → 1/0.78 overflow).
  const rotated = page.rotation === 90 || page.rotation === 270;
  const pageStyle: React.CSSProperties = {
    width: box?.w,
    height: box?.h,
    transform: `rotate(${page.rotation}deg) scale(${rotated ? aspect : 1})`,
  };

  return (
    <div
      ref={setRefs}
      style={style}
      className={`card${selected ? ' selected' : ''}${isDragging ? ' dragging' : ''}${
        isOver ? ' over' : ''
      }`}
      onClick={(e) => onSelect(page.id, e)}
      onDoubleClick={() => onOpenPreview(page.id)}
      {...attributes}
      {...listeners}
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
        <Maximize2 size={15} />
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
          <div className="card-page" style={pageStyle}>
            <div className={`card-canvas-host${rendered ? '' : ' skeleton'}`} ref={hostRef} />
            {page.crop && (
              <div
                className="card-crop"
                style={{
                  left: `${page.crop.x * 100}%`,
                  top: `${page.crop.y * 100}%`,
                  width: `${page.crop.w * 100}%`,
                  height: `${page.crop.h * 100}%`,
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="card-footer">
        <span className="card-label">Page {page.pageIndex + 1}</span>
        {showParts && <span className="card-part">Part {partNumber}</span>}
        <span className="card-ops" onPointerDown={(e) => e.stopPropagation()}>
          <button title="Rotate" onClick={(e) => { e.stopPropagation(); onRotate(page.id, 90); }}>
            <RotateCw size={15} />
          </button>
          <button
            title={splitMark ? 'Remove split' : 'Split after this page'}
            onClick={(e) => { e.stopPropagation(); onToggleSplit(page.id); }}
          >
            <Scissors size={15} />
          </button>
          <button className="op-del" title="Delete page" onClick={(e) => { e.stopPropagation(); onDelete(page.id); }}>
            <X size={15} />
          </button>
        </span>
      </div>
    </div>
  );
}
