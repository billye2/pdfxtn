import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PageDescriptor } from '../lib/pageModel';
import { renderThumbnail, type LoadedDoc } from '../lib/pdfRender';

interface Props {
  page: PageDescriptor;
  doc: LoadedDoc | undefined;
  /** Bounding rect of the card this peek is anchored to (viewport coords). */
  anchor: DOMRect;
}

const MARGIN = 12; // keep this far from the viewport edges

/**
 * A floating, read-only enlargement of a single page, anchored near its card.
 * Used to confirm a page's content before/while reordering on small displays,
 * where the grid thumbnails are too small to read. Purely passive
 * (pointer-events: none) so it never interferes with drag or selection.
 */
export default function PagePeek({ page, doc, anchor }: Props) {
  const popRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Render the page unrotated; rotation/crop are applied via CSS like the
  // lightbox so the peek matches what export will produce.
  useEffect(() => {
    let cancelled = false;
    if (!doc || !hostRef.current) return;
    setLoading(true);
    renderThumbnail(doc, page.pageIndex, { rotation: 0, maxEdge: 900 })
      .then((canvas) => {
        if (cancelled || !hostRef.current) return;
        canvas.className = 'page-peek-canvas';
        hostRef.current.replaceChildren(canvas);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [doc, page.pageIndex]);

  // Position the popover near its card, preferring above, clamped to the
  // viewport. Recompute once the canvas attaches (size changes) and on resize.
  useLayoutEffect(() => {
    const pop = popRef.current;
    if (!pop) return;
    const reposition = () => {
      const pw = pop.offsetWidth;
      const ph = pop.offsetHeight;
      if (!pw || !ph) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cx = anchor.left + anchor.width / 2;
      const left = Math.max(MARGIN, Math.min(cx - pw / 2, vw - pw - MARGIN));
      let top = anchor.top - ph - MARGIN; // prefer above the card
      if (top < MARGIN) top = anchor.bottom + MARGIN; // else below
      top = Math.max(MARGIN, Math.min(top, vh - ph - MARGIN));
      setPos({ left, top });
    };
    reposition();
    const ro = new ResizeObserver(reposition);
    ro.observe(pop);
    return () => ro.disconnect();
  }, [anchor, loading]);

  // The peek floats above the card, so the cursor is rarely over it. While it's
  // open, claim the wheel to scroll the clipped page instead of the grid (which
  // would scroll the card out from under the anchor and dismiss the peek).
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const view = viewRef.current;
      if (!view || view.scrollHeight <= view.clientHeight) return;
      e.preventDefault();
      view.scrollTop += e.deltaY;
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  const rotated = page.rotation === 90 || page.rotation === 270;

  return createPortal(
    <div
      ref={popRef}
      className="page-peek"
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      <div className="page-peek-view" ref={viewRef}>
        <div
          className={`page-peek-stage${loading ? ' loading' : ''}`}
          style={{
            transform: `rotate(${page.rotation}deg) scale(${rotated ? 0.78 : 1})`,
          }}
        >
          <div className="page-peek-host" ref={hostRef} />
          {page.crop && (
            <div
              className="page-peek-crop"
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
      <span className="page-peek-label">Page {page.pageIndex + 1}</span>
    </div>,
    document.body,
  );
}
