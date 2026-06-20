import { RotateCw, Crop, CopyCheck, X } from './icons';

interface Props {
  count: number;
  onRotate: (delta: 90 | -90) => void;
  onCrop: () => void;
  onExtract: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export default function SelectionDock({
  count,
  onRotate,
  onCrop,
  onExtract,
  onDelete,
  onClear,
}: Props) {
  return (
    <div className="dock">
      <span className="dock-count">{count}</span>
      <span className="dock-label">picked</span>
      <span className="dock-divider" />

      <button className="btn-rotate dock-btn" onClick={() => onRotate(90)}>
        <RotateCw size={16} />
        Rotate
      </button>
      <button className="btn-crop dock-btn" onClick={onCrop}>
        <Crop size={16} />
        Crop
      </button>
      <button className="btn-add dock-btn" onClick={onExtract}>
        <CopyCheck size={16} />
        Keep these
      </button>
      <button className="btn-del dock-btn" onClick={onDelete}>
        <X size={16} />
        Delete
      </button>

      <span className="dock-divider" />
      <button className="btn-secondary dock-btn icon-only" title="Clear selection" onClick={onClear}>
        <X size={16} />
      </button>
    </div>
  );
}
