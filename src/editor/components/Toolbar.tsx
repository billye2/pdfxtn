import { useRef } from 'react';
import {
  ArrowLeftRight,
  FileOutput,
  Images,
  Plus,
  RotateCw,
  Crop,
  Scissors,
  X,
  Undo2,
  Redo2,
  Shuffle,
  SplitSquareHorizontal,
} from './icons';
import './Toolbar.css';

interface Props {
  hasPages: boolean;
  selectedCount: number;
  hasCrop: boolean;
  canOpenMix: boolean;
  canReverse: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onAddFiles: (files: FileList) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onRotateSelected: (delta: 90 | -90) => void;
  onDeleteSelected: () => void;
  onOpenCrop: () => void;
  onSplit: () => void;
  onOpenSplitEvery: () => void;
  onOpenMix: () => void;
  onReverse: () => void;
  onClearCrop: () => void;
  onOpenRange: () => void;
  onOpenImages: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export default function Toolbar(props: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const hasSel = props.selectedCount > 0;

  return (
    <div className="toolbar">
      <div className="tgroup">
        <button
          className="btn-add"
          title="Add PDFs or JPG/PNG images — pages append to the document"
          onClick={() => fileRef.current?.click()}
        >
          <Plus size={16} /> Add PDF
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) props.onAddFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <div className="tgroup">
        <button
          className="btn-secondary"
          title="Select every page (Cmd/Ctrl+A)"
          onClick={props.onSelectAll}
          disabled={!props.hasPages}
        >
          Select all
        </button>
        <button
          className="btn-secondary"
          title="Clear the selection (Esc)"
          onClick={props.onClearSelection}
          disabled={!hasSel}
        >
          Clear
        </button>
      </div>

      <span className="tdivider" />

      <div className="tgroup">
        <button
          className="btn-rotate"
          title="Rotate the picked pages 90° clockwise (R)"
          onClick={() => props.onRotateSelected(90)}
          disabled={!hasSel}
        >
          <RotateCw size={16} /> Rotate
        </button>
        <button
          className="btn-crop"
          title="Draw one crop and apply it to all or just the picked pages (C)"
          onClick={props.onOpenCrop}
          disabled={!props.hasPages}
        >
          <Crop size={16} /> Crop
        </button>
        <button
          className="btn-split"
          title="Mark a split after each picked page — Save then makes one file per part (S)"
          onClick={props.onSplit}
          disabled={!hasSel}
        >
          <Scissors size={16} /> Split
        </button>
        <button
          className="btn-del"
          title="Delete the picked pages (Delete)"
          onClick={props.onDeleteSelected}
          disabled={!hasSel}
        >
          <X size={16} /> Delete
        </button>
      </div>

      <span className="tspacer" />

      <div className="tgroup">
        <button
          className="btn-secondary"
          onClick={props.onOpenMix}
          disabled={!props.canOpenMix}
          title="Interleave documents, or un-mix a double-sided scan"
        >
          <Shuffle size={16} /> Mix
        </button>
        <button
          className="btn-secondary"
          title="Add a split mark every N pages"
          onClick={props.onOpenSplitEvery}
          disabled={!props.hasPages}
        >
          <SplitSquareHorizontal size={16} /> Split every…
        </button>
        <button
          className="btn-secondary icon-btn"
          title={props.selectedCount >= 2 ? 'Reverse picked pages' : 'Reverse page order'}
          onClick={props.onReverse}
          disabled={!props.canReverse}
        >
          <ArrowLeftRight size={18} />
        </button>
      </div>

      <button
        className="btn-secondary icon-btn"
        aria-label="Export range…"
        title="Export range… — save pages by position (e.g. 1-3, 5)"
        onClick={props.onOpenRange}
        disabled={!props.hasPages}
      >
        <FileOutput size={18} />
      </button>
      <button
        className="btn-secondary icon-btn"
        aria-label="Export images…"
        title="Export images… — save pages as PNG or JPG"
        onClick={props.onOpenImages}
        disabled={!props.hasPages}
      >
        <Images size={18} />
      </button>
      {props.hasCrop && (
        <button
          className="btn-secondary"
          title="Remove the crop from every page"
          onClick={props.onClearCrop}
        >
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
