import { useState } from 'react';
import type { ImageFormat } from '../lib/pdfImages';

interface Props {
  total: number;
  onExport: (opts: { format: ImageFormat; scale: number }) => void;
  onCancel: () => void;
}

const SCALES = [
  { value: 1, label: '1× (~72 dpi)' },
  { value: 2, label: '2× (~144 dpi)' },
  { value: 3, label: '3× (~216 dpi)' },
];

export default function ImagesDialog({ total, onExport, onCancel }: Props) {
  const [format, setFormat] = useState<ImageFormat>('png');
  const [scale, setScale] = useState(2);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Export pages as images</h2>
        <p className="modal-help">
          Saves one image per page ({total} total), reflecting current rotation and crop.
        </p>

        <div className="field-row">
          <span className="field-label">Format</span>
          <div className="seg">
            <button
              className={`seg-btn${format === 'png' ? ' active' : ''}`}
              onClick={() => setFormat('png')}
            >
              PNG
            </button>
            <button
              className={`seg-btn${format === 'jpeg' ? ' active' : ''}`}
              onClick={() => setFormat('jpeg')}
            >
              JPG
            </button>
          </div>
        </div>

        <div className="field-row">
          <span className="field-label">Resolution</span>
          <div className="seg">
            {SCALES.map((s) => (
              <button
                key={s.value}
                className={`seg-btn${scale === s.value ? ' active' : ''}`}
                onClick={() => setScale(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-go" onClick={() => onExport({ format, scale })}>
            Export {total} image{total === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}
