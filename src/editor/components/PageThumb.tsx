import { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RotateCw, Scissors, X, Check, Maximize2 } from './icons';
import type { PageDescriptor } from '../lib/pageModel';
import { renderThumbnail, type LoadedDoc } from '../lib/pdfRender';
import PagePeek from './PagePeek';

const HOVER_PEEK_DELAY = 450; // ms a mouse must dwell before the peek appears
const PRESS_PEEK_DELAY = 500; // ms of long-press (touch/pen) before the peek appears

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

  // Peek: a larger floating preview shown on hover-dwell (mouse) or long-press
  // (touch), so the page is legible enough to confirm before/while reordering.
  const [peekAnchor, setPeekAnchor] = useState<DOMRect | null>(null);
  const peekTimer = useRef<number | null>(null);
  const pressPos = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  const clearPeekTimer = () => {
    if (peekTimer.current !== null) {
      clearTimeout(peekTimer.current);
      peekTimer.current = null;
    }
  };
  const hidePeek = () => {
    clearPeekTimer();
    setPeekAnchor(null);
  };
  const schedulePeek = (delay: number, suppressNextClick: boolean) => {
    clearPeekTimer();
    peekTimer.current = window.setTimeout(() => {
      const node = rootRef.current;
      if (!node) return;
      if (suppressNextClick) suppressClick.current = true;
      setPeekAnchor(node.getBoundingClientRect());
    }, delay);
  };

  // Scrolling the grid or resizing invalidates the anchor rect, so dismiss the
  // peek — but ignore scrolls originating inside the peek itself (it scrolls its
  // own clipped page in response to the wheel).
  useEffect(() => {
    if (!peekAnchor) return;
    const dismiss = (e: Event) => {
      if (e.target instanceof Element && e.target.closest('.page-peek')) return;
      clearPeekTimer();
      setPeekAnchor(null);
    };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [peekAnchor]);

  useEffect(
    () => () => {
      if (peekTimer.current !== null) clearTimeout(peekTimer.current);
    },
    [],
  );

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

  // Long-press (touch/pen) starts a peek; compose with dnd-kit's own
  // onPointerDown so dragging keeps working.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    listeners?.onPointerDown?.(e);
    pressPos.current = { x: e.clientX, y: e.clientY };
    if (e.pointerType !== 'mouse') schedulePeek(PRESS_PEEK_DELAY, true);
  };

  // A press that moves past the drag threshold is a drag, not a peek — dismiss.
  // Plain hover (no button held) keeps its peek as the pointer moves.
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = pressPos.current;
    if (!start || e.buttons === 0) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) {
      pressPos.current = null;
      hidePeek();
    }
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
      onClick={(e) => {
        // Swallow the click that ends a long-press peek so it doesn't select.
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onSelect(page.id, e);
      }}
      onDoubleClick={() => onOpenPreview(page.id)}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') schedulePeek(HOVER_PEEK_DELAY, false);
      }}
      onPointerLeave={hidePeek}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => {
        pressPos.current = null;
        if (e.pointerType !== 'mouse') hidePeek();
      }}
      onPointerCancel={() => {
        pressPos.current = null;
        hidePeek();
      }}
      {...attributes}
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
            <div
              className={`card-canvas-host${rendered ? '' : ' skeleton'}`}
              ref={hostRef}
            />
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

      {peekAnchor && <PagePeek page={page} doc={doc} anchor={peekAnchor} />}
    </div>
  );
}
