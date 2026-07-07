import { useState } from 'react';
import Modal from './Modal';
import './SplitEveryDialog.css';

interface Props {
  total: number;
  onApply: (n: number) => void;
  onCancel: () => void;
}

export default function SplitEveryDialog({ total, onApply, onCancel }: Props) {
  const [value, setValue] = useState('1');

  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 1 && n < total;
  const parts = valid ? Math.ceil(total / n) : 0;

  function apply() {
    if (valid) onApply(n);
  }

  return (
    <Modal title="Split every N pages" onClose={onCancel}>
      <p className="modal-help">
        Break this {total}-page document into parts of equal length. Each part becomes a
        separate file when you save.
      </p>

      <div className="split-every-row">
        <span>Split every</span>
        <input
          className="range-input split-n"
          type="number"
          aria-label="Pages per part"
          min={1}
          max={total - 1}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply();
          }}
        />
        <span>pages</span>
      </div>

      <div className="range-status">
        {valid ? (
          <span>
            → {parts} file{parts === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="range-error">Enter a number between 1 and {total - 1}</span>
        )}
      </div>

      <div className="modal-footer">
        <button className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-go" onClick={apply} disabled={!valid}>
          Apply split marks
        </button>
      </div>
    </Modal>
  );
}
