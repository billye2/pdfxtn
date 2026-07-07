import type { ReactNode } from 'react';
import './SegmentedControl.css';

export interface SegOption<T> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

interface Props<T> {
  options: SegOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible label for the group (e.g. "Format"). */
  ariaLabel?: string;
}

/** A row of mutually-exclusive "segmented" buttons (the `.seg` pattern). */
export default function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: Props<T>) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          className={`seg-btn${opt.value === value ? ' active' : ''}`}
          aria-pressed={opt.value === value}
          disabled={opt.disabled}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
