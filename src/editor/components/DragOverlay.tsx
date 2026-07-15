import { useState } from 'react';
import { Download } from './icons';
import './DragOverlay.css';

export default function DragOverlay() {
  // Pin the panel to the .main content area (below header/toolbar/banners) so
  // its dashed box lands exactly on the EmptyState drop-zone when the grid is
  // empty — same 20px padding + 80% box as .empty/.drop-zone. The dim backdrop
  // still covers the whole window. Measured once on mount (lazy initializer —
  // the overlay only exists while a file drag is in flight, so one measurement
  // per appearance is fresh enough).
  const [area] = useState<React.CSSProperties | undefined>(() => {
    const r = document.querySelector('.main')?.getBoundingClientRect();
    return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : undefined;
  });

  return (
    <div className="drag-overlay">
      <div className="drag-align" style={area}>
        <div className="drag-panel">
          <Download size={46} />
          <p>Drop to add your pages!</p>
        </div>
      </div>
    </div>
  );
}
