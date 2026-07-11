import { RotateCw, Crop, Copy, Plus, CopyCheck, X } from './icons';
import './SelectionDock.css';

interface Props {
  count: number;
  onRotate: (delta: 90 | -90) => void;
  onCrop: () => void;
  onDuplicate: () => void;
  onInsertBlank: () => void;
  onExtract: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export default function SelectionDock({
  count,
  onRotate,
  onCrop,
  onDuplicate,
  onInsertBlank,
  onExtract,
  onDelete,
  onClear,
}: Props) {
  return (
    <div className="dock">
      <span className="dock-count">{count}</span>
      <span className="dock-label">picked</span>
      <span className="dock-divider" />

      <button
        className="btn-rotate dock-btn"
        title="Rotate the picked pages 90° clockwise (R)"
        onClick={() => onRotate(90)}
      >
        <RotateCw size={16} />
        Rotate
      </button>
      <button
        className="btn-crop dock-btn"
        title="Crop the picked pages (C)"
        onClick={onCrop}
      >
        <Crop size={16} />
        Crop
      </button>
      <button
        className="btn-go dock-btn"
        title="Duplicate the picked pages (Cmd/Ctrl+D)"
        onClick={onDuplicate}
      >
        <Copy size={16} />
        Duplicate
      </button>
      <button
        className="btn-secondary dock-btn"
        title="Insert a blank page after the last picked page (B)"
        onClick={onInsertBlank}
      >
        <Plus size={16} />
        Blank page
      </button>
      <button
        className="btn-add dock-btn"
        title="Keep only the picked pages (K)"
        onClick={onExtract}
      >
        <CopyCheck size={16} />
        Keep these
      </button>
      <button
        className="btn-del dock-btn"
        title="Delete the picked pages (Delete)"
        onClick={onDelete}
      >
        <X size={16} />
        Delete
      </button>

      <span className="dock-divider" />
      <button
        className="btn-secondary dock-btn icon-only"
        title="Clear selection"
        onClick={onClear}
      >
        <X size={16} />
      </button>
    </div>
  );
}
