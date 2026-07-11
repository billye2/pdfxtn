import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import type { CropRect, PageDescriptor } from '../lib/pageModel';
import { renderThumbnail, type LoadedDoc } from '../lib/pdfRender';
import './CropDialog.css';

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

// The preview fills the available viewport (capped) while keeping the page
// aspect ratio, so portrait and landscape pages both get a generous canvas.
const PREVIEW_MAX_W = 620; // px
const PREVIEW_VIEWPORT_H = 0.72; // fraction of window height the stage may use

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
  const [liveBox, setLiveBox] = useState(''); // SR announcement of the box
  const drag = useRef<{ ax: number; ay: number; mode: 'draw' | 'resize' } | null>(null);

  useEffect(() => {
    let cancelled = false;
    renderThumbnail(doc, page.pageIndex, { rotation: 0, maxEdge: 1000 }).then(
      (canvas) => {
        if (cancelled || !stageRef.current) return;
        const aspect = canvas.height / canvas.width;
        // Fit the page within both a width cap and a share of the viewport height.
        const maxW = Math.min(PREVIEW_MAX_W, window.innerWidth * 0.9);
        const maxH = window.innerHeight * PREVIEW_VIEWPORT_H;
        let w = maxW;
        let h = w * aspect;
        if (h > maxH) {
          h = maxH;
          w = h / aspect;
        }
        canvas.className = 'crop-canvas';
        stageRef.current.replaceChildren(canvas);
        setSize({ w, h });
        // Seed the reference page's existing crop so re-cropping starts from
        // the current box instead of an empty stage.
        const crop = page.crop;
        if (crop) {
          setRect({ x: crop.x * w, y: crop.y * h, w: crop.w * w, h: crop.h * h });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [doc, page.pageIndex, page.crop]);

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
    drag.current = { ax: p.x, ay: p.y, mode: 'draw' };
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  }

  // Grabbing a corner resizes the box: pin the opposite corner as the anchor and
  // reuse the same draw math. Dragging past the opposite edge flips naturally.
  function startResize(e: React.PointerEvent<HTMLSpanElement>) {
    if (!rect) return;
    e.stopPropagation();
    stageRef.current?.setPointerCapture(e.pointerId);
    const corner = e.currentTarget.dataset.corner as 'tl' | 'tr' | 'bl' | 'br';
    const right = rect.x + rect.w;
    const bottom = rect.y + rect.h;
    const anchor = {
      tl: { ax: right, ay: bottom },
      tr: { ax: rect.x, ay: bottom },
      bl: { ax: right, ay: rect.y },
      br: { ax: rect.x, ay: rect.y },
    }[corner];
    drag.current = { ...anchor, mode: 'resize' };
  }

  function move(e: React.PointerEvent) {
    if (!drag.current) return;
    const p = rel(e);
    const { ax, ay } = drag.current;
    setRect({
      x: Math.min(ax, p.x),
      y: Math.min(ay, p.y),
      w: Math.abs(p.x - ax),
      h: Math.abs(p.y - ay),
    });
  }

  function up() {
    // If the user barely dragged a *new* box, reset to a sensible default centered
    // region. A resize that collapses the box is left as-is (no snap-to-default).
    if (drag.current?.mode === 'draw' && rect && size && (rect.w < 4 || rect.h < 4)) {
      setRect({ x: size.w * 0.15, y: size.h * 0.15, w: size.w * 0.7, h: size.h * 0.7 });
    }
    drag.current = null;
  }

  // Keyboard path: an arrow (or Enter) with no box places the same centered
  // default the tiny-drag snap uses; arrows then move it and Shift+arrows
  // resize from the bottom-right edge. 2% steps — key-repeat makes it glide.
  const KEY_STEP = 0.02;
  const MIN_KEY_SIZE = 20; // px — don't let keyboard shrinking collapse the box

  function announce(r: PxRect, s: { w: number; h: number }) {
    const pct = (v: number, total: number) => Math.round((v / total) * 100);
    setLiveBox(
      `Box: left ${pct(r.x, s.w)}%, top ${pct(r.y, s.h)}%, ` +
        `width ${pct(r.w, s.w)}%, height ${pct(r.h, s.h)}%.`,
    );
  }

  function stageKeyDown(e: React.KeyboardEvent) {
    if (!size) return;
    const arrows = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (!arrows.includes(e.key) && e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();

    if (!rect || rect.w < 4 || rect.h < 4) {
      const start = {
        x: size.w * 0.15,
        y: size.h * 0.15,
        w: size.w * 0.7,
        h: size.h * 0.7,
      };
      setRect(start);
      announce(start, size);
      return;
    }
    if (e.key === 'Enter') return; // Enter only places the starting box

    const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    let next: PxRect;
    if (e.shiftKey) {
      next = {
        ...rect,
        w: Math.min(
          Math.max(rect.w + dx * size.w * KEY_STEP, MIN_KEY_SIZE),
          size.w - rect.x,
        ),
        h: Math.min(
          Math.max(rect.h + dy * size.h * KEY_STEP, MIN_KEY_SIZE),
          size.h - rect.y,
        ),
      };
    } else {
      next = {
        ...rect,
        x: Math.min(Math.max(rect.x + dx * size.w * KEY_STEP, 0), size.w - rect.w),
        y: Math.min(Math.max(rect.y + dy * size.h * KEY_STEP, 0), size.h - rect.h),
      };
    }
    setRect(next);
    announce(next, size);
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
      <p className="modal-help">
        Drag a box across the page — or press the arrow keys (Shift+arrows to resize).
      </p>

      <div
        ref={stageRef}
        className="crop-stage"
        style={size ? { width: size.w, height: size.h } : undefined}
        tabIndex={0}
        role="group"
        aria-label="Crop box — arrow keys move it, Shift+arrow keys resize it"
        onKeyDown={stageKeyDown}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
      >
        {rect && (
          <div
            className="crop-rect"
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
          >
            <span
              className="crop-handle tl"
              data-corner="tl"
              onPointerDown={startResize}
            />
            <span
              className="crop-handle tr"
              data-corner="tr"
              onPointerDown={startResize}
            />
            <span
              className="crop-handle bl"
              data-corner="bl"
              onPointerDown={startResize}
            />
            <span
              className="crop-handle br"
              data-corner="br"
              onPointerDown={startResize}
            />
          </div>
        )}
      </div>

      <div className="sr-only" aria-live="polite" role="status">
        {liveBox}
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
