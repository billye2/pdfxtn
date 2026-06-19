import { useRef } from 'react';
import {
  Plus,
  RotateCcw,
  RotateCw,
  Crop,
  Scissors,
  X,
  Undo2,
  Redo2,
} from './icons';

interface Props {
  selectedCount: number;
  hasCrop: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onAddFiles: (files: FileList) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onRotateSelected: (delta: 90 | -90) => void;
  onDeleteSelected: () => void;
  onOpenCrop: () => void;
  onSplit: () => void;
  onClearCrop: () => void;
  onOpenRange: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export default function Toolbar(props: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const hasSel = props.selectedCount > 0;

  return (
    <div className="toolbar">
      <div className="tgroup">
        <button className="btn-add" onClick={() => fileRef.current?.click()}>
          <Plus size={16} /> Add pages
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) props.onAddFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <span className="tdivider" />

      <div className="tgroup">
        <button className="btn-secondary" onClick={props.onSelectAll}>
          Select all
        </button>
        <button className="btn-secondary" onClick={props.onClearSelection} disabled={!hasSel}>
          Clear
        </button>
      </div>

      <span className="tdivider" />

      <div className="tgroup">
        <button className="btn-rotate" onClick={() => props.onRotateSelected(-90)} disabled={!hasSel}>
          <RotateCcw size={16} /> Turn
        </button>
        <button className="btn-rotate" onClick={() => props.onRotateSelected(90)} disabled={!hasSel}>
          <RotateCw size={16} /> Turn
        </button>
        <button className="btn-crop" onClick={props.onOpenCrop}>
          <Crop size={16} /> Crop
        </button>
        <button className="btn-split" onClick={props.onSplit} disabled={!hasSel}>
          <Scissors size={16} /> Split
        </button>
        <button className="btn-del" onClick={props.onDeleteSelected} disabled={!hasSel}>
          <X size={16} /> Delete
        </button>
      </div>

      <span className="tspacer" />

      <button className="btn-secondary" onClick={props.onOpenRange}>
        Export range…
      </button>
      {props.hasCrop && (
        <button className="btn-secondary" onClick={props.onClearCrop}>
          Clear crop
        </button>
      )}
      <button
        className="btn-secondary icon-btn"
        title="Undo (Cmd/Ctrl+Z)"
        onClick={props.onUndo}
        disabled={!props.canUndo}
      >
        <Undo2 size={18} />
      </button>
      <button
        className="btn-secondary icon-btn"
        title="Redo (Cmd/Ctrl+Shift+Z)"
        onClick={props.onRedo}
        disabled={!props.canRedo}
      >
        <Redo2 size={18} />
      </button>
    </div>
  );
}
