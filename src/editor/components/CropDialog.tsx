import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import type { CropRect, PageDescriptor } from '../lib/pageModel';
import { renderThumbnail, type LoadedDoc } from '../lib/pdfRender';

interface Props {
  page: PageDescriptor;
  doc: LoadedDoc;
  selectedCount: number;
  onApply: (crop: CropRect, scope: 'all' | 'selected') => void;
  onCancel: () => void;
}

interface PxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PREVIEW_W = 240; // px; height follows the 0.78 page aspect

// Crop is defined over the unrotated page (rotation 0) to match pdfExport.
export default function CropDialog({
  page,
  doc,
  selectedCount,
  onApply,
  onCancel,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [rect, setRect] = useState<PxRect | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    renderThumbnail(doc, page.pageIndex, { rotation: 0, maxEdge: 480 }).then((canvas) => {
      if (cancelled || !stageRef.current) return;
      const h = (canvas.height / canvas.width) * PREVIEW_W;
      canvas.className = 'crop-canvas';
      stageRef.current.replaceChildren(canvas);
      setSize({ w: PREVIEW_W, h });
    });
    return () => {
      cancelled = true;
    };
  }, [doc, page.pageIndex]);

  function rel(e: React.PointerEvent) {
    const r = stageRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max(e.clientX - r.left, 0), r.width),
      y: Math.min(Math.max(e.clientY - r.top, 0), r.height),
    };
  }

  function down(e: React.PointerEvent) {
    stageRef.current?.setPointerCapture(e.pointerId);
    const p = rel(e);
    drag.current = p;
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  function move(e: React.PointerEvent) {
    if (!drag.current) return;
    const p = rel(e);
    const s = drag.current;
    setRect({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  }

  function up() {
    // If the user barely dragged, reset to a sensible default centered region.
    if (rect && size && (rect.w < 4 || rect.h < 4)) {
      setRect({ x: size.w * 0.15, y: size.h * 0.15, w: size.w * 0.7, h: size.h * 0.7 });
    }
    drag.current = null;
  }

  function toCrop(): CropRect | null {
    if (!rect || !size || rect.w < 4 || rect.h < 4) return null;
    return {
      x: rect.x / size.w,
      y: rect.y / size.h,
      w: rect.w / size.w,
      h: rect.h / size.h,
    };
  }

  function apply(scope: 'all' | 'selected') {
    const crop = toCrop();
    if (crop) onApply(crop, scope);
  }

  const hasRect = !!rect && rect.w >= 4 && rect.h >= 4;

  return (
    <Modal title="Crop your pages" onClose={onCancel} className="crop-modal">
      <p className="modal-help">Drag a box across the page to choose what to keep.</p>

      <div
        ref={stageRef}
        className="crop-stage"
        style={size ? { width: size.w, height: size.h } : undefined}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
      >
        {rect && (
          <div
            className="crop-rect"
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
          >
            <span className="crop-handle tl" />
            <span className="crop-handle tr" />
            <span className="crop-handle bl" />
            <span className="crop-handle br" />
          </div>
        )}
      </div>

      <div className="modal-footer">
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn-secondary"
          disabled={!hasRect || selectedCount === 0}
          onClick={() => apply('selected')}
        >
          Keep {selectedCount} picked
        </button>
        <button className="btn-go" disabled={!hasRect} onClick={() => apply('all')}>
          Apply to all
        </button>
      </div>
    </Modal>
  );
}
