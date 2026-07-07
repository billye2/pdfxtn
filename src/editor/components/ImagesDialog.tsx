import { useMemo, useState } from 'react';
import Modal from './Modal';
import SegmentedControl from './SegmentedControl';
import type { ImageFormat } from '../lib/pdfImages';
import { parsePageRange } from '../lib/pageRange';

type Scope = 'all' | 'selected' | 'custom';

interface Props {
  total: number;
  /** 0-based indices of pages currently selected in the editor, in page order. */
  selectedIndices: number[];
  onExport: (opts: {
    format: ImageFormat;
    scale: number;
    indices: number[];
    zip: boolean;
  }) => void;
  onCancel: () => void;
}

const SCALES = [
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 3, label: '3×' },
];

export default function ImagesDialog({
  total,
  selectedIndices,
  onExport,
  onCancel,
}: Props) {
  const [format, setFormat] = useState<ImageFormat>('png');
  const [scale, setScale] = useState(2);
  const [scope, setScope] = useState<Scope>(selectedIndices.length ? 'selected' : 'all');
  const [range, setRange] = useState('');
  // Default to a single zip for multi-page exports (avoids N browser downloads).
  const [zip, setZip] = useState(total > 1);

  // Resolve the chosen scope to a concrete list of page indices (+ any error).
  const resolved = useMemo<{ indices: number[]; error: string }>(() => {
    if (scope === 'all') {
      return { indices: Array.from({ length: total }, (_, i) => i), error: '' };
    }
    if (scope === 'selected') {
      return {
        indices: selectedIndices,
        error: selectedIndices.length ? '' : 'No pages are selected',
      };
    }
    if (!range.trim()) return { indices: [], error: '' };
    try {
      return { indices: parsePageRange(range, total), error: '' };
    } catch (e) {
      return { indices: [], error: (e as Error).message };
    }
  }, [scope, range, total, selectedIndices]);

  const count = resolved.indices.length;

  return (
    <Modal title="Export pages as images" onClose={onCancel}>
      <p className="modal-help">
        Saves one image per page, reflecting current rotation and crop.
      </p>

      <div className="field-row">
        <span className="field-label">Pages</span>
        <SegmentedControl
          ariaLabel="Pages"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: `All (${total})` },
            {
              value: 'selected',
              label: `Selected (${selectedIndices.length})`,
              disabled: selectedIndices.length === 0,
            },
            { value: 'custom', label: 'Custom…' },
          ]}
        />
      </div>

      {scope === 'custom' && (
        <>
          <input
            className="range-input"
            aria-label="Custom page range"
            autoFocus
            placeholder="e.g. 1-3, 5, 8-10"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          />
          <p className="modal-help field-note">
            Counts by position in the current order (1–{total}), not the "Page N" labels.
          </p>
        </>
      )}

      <div className="field-row">
        <span className="field-label">Format</span>
        <SegmentedControl
          ariaLabel="Format"
          value={format}
          onChange={setFormat}
          options={[
            { value: 'png', label: 'PNG' },
            { value: 'jpeg', label: 'JPG' },
          ]}
        />
      </div>

      <div className="field-row">
        <span className="field-label">Resolution</span>
        <SegmentedControl
          ariaLabel="Resolution"
          value={scale}
          onChange={setScale}
          options={SCALES}
        />
      </div>

      <label className="zip-toggle">
        <input
          type="checkbox"
          checked={zip && count > 1}
          disabled={count < 2}
          onChange={(e) => setZip(e.target.checked)}
        />
        <span>Bundle into a single .zip</span>
      </label>

      <div className="range-status">
        {resolved.error ? (
          <span className="range-error">{resolved.error}</span>
        ) : (
          <span>
            {count} image{count === 1 ? '' : 's'} to export
          </span>
        )}
      </div>

      <div className="modal-footer">
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn-go"
          disabled={count === 0}
          onClick={() =>
            onExport({ format, scale, indices: resolved.indices, zip: zip && count > 1 })
          }
        >
          Export {count} image{count === 1 ? '' : 's'}
        </button>
      </div>
    </Modal>
  );
}
