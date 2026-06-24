import { useEffect, useRef, useState } from 'react';
import { RotateCw, Crop, X, ChevronLeft, ChevronRight } from './icons';
import type { PageDescriptor } from '../lib/pageModel';
import { renderThumbnail, type LoadedDoc } from '../lib/pdfRender';

interface Props {
  page: PageDescriptor;
  index: number;
  total: number;
  doc: LoadedDoc | undefined;
  onPrev: () => void;
  onNext: () => void;
  onRotate: (delta: 90 | -90) => void;
  onDelete: () => void;
  onCrop: () => void;
  onClose: () => void;
}

export default function Lightbox({
  page,
  index,
  total,
  doc,
  onPrev,
  onNext,
  onRotate,
  onDelete,
  onCrop,
  onClose,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);

  // Render the page large and unrotated; rotation is applied via CSS transform.
  useEffect(() => {
    let cancelled = false;
    if (!doc || !hostRef.current) return;
    setLoading(true);
    if (viewRef.current) viewRef.current.scrollTop = 0; // start a new page at the top
    renderThumbnail(doc, page.pageIndex, { rotation: 0, maxEdge: 1500 })
      .then((canvas) => {
        if (cancelled || !hostRef.current) return;
        canvas.className = 'lightbox-canvas';
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

  const rotated = page.rotation === 90 || page.rotation === 270;

  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <button
        className="lightbox-nav left"
        title="Previous (←)"
        disabled={index <= 0}
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
      >
        <ChevronLeft size={28} />
      </button>

      <div className="lightbox-body" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-stagewrap">
          <div className="lightbox-view" ref={viewRef}>
            <div
              className={`lightbox-stage${loading ? ' loading' : ''}`}
              style={{
                transform: `rotate(${page.rotation}deg) scale(${rotated ? 0.78 : 1})`,
              }}
            >
              <div className="lightbox-host" ref={hostRef} />
              {page.crop && (
                <div
                  className="lightbox-crop"
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

        <div className="lightbox-bar">
          <span className="lightbox-counter">
            Page {page.pageIndex + 1}
            <span className="lightbox-pos">
              {index + 1} of {total}
            </span>
          </span>
          <span className="lightbox-actions">
            <button className="btn-rotate" onClick={() => onRotate(90)}>
              <RotateCw size={16} /> Rotate
            </button>
            <button className="btn-crop" onClick={onCrop}>
              <Crop size={16} /> Crop
            </button>
            <button className="btn-del" onClick={onDelete}>
              <X size={16} /> Delete
            </button>
          </span>
        </div>
      </div>

      <button
        className="lightbox-nav right"
        title="Next (→)"
        disabled={index >= total - 1}
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
      >
        <ChevronRight size={28} />
      </button>

      <button className="lightbox-close" title="Close (Esc)" onClick={onClose}>
        <X size={22} />
      </button>
    </div>
  );
}
