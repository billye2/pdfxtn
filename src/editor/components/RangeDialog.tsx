import { useMemo, useState } from 'react';
import { parsePageRange } from '../lib/pageRange';

interface Props {
  total: number;
  onExport: (indices: number[]) => void;
  onCancel: () => void;
}

export default function RangeDialog({ total, onExport, onCancel }: Props) {
  const [value, setValue] = useState('');

  // Live-parse to preview the count and surface errors before exporting.
  const parsed = useMemo(() => {
    if (!value.trim()) return { indices: null as number[] | null, error: '' };
    try {
      return { indices: parsePageRange(value, total), error: '' };
    } catch (e) {
      return { indices: null, error: (e as Error).message };
    }
  }, [value, total]);

  function submit() {
    if (parsed.indices && parsed.indices.length) onExport(parsed.indices);
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Export by position</h2>
        <p className="modal-help">
          Type page positions in the current order — 1 is the first page, {total} is the
          last — not the "Page N" labels. Example: <code>1-3, 5, 8-10</code>
        </p>

        <input
          className="range-input"
          autoFocus
          placeholder="e.g. 1-3, 5, 8-10"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onCancel();
          }}
        />

        <div className="range-status">
          {parsed.error ? (
            <span className="range-error">{parsed.error}</span>
          ) : parsed.indices ? (
            <span>
              {parsed.indices.length} page{parsed.indices.length === 1 ? '' : 's'} selected
            </span>
          ) : (
            <span>&nbsp;</span>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-go" disabled={!parsed.indices?.length} onClick={submit}>
            Export these pages
          </button>
        </div>
      </div>
    </div>
  );
}
