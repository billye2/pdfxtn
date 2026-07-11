import './EmptyState.css';

interface Props {
  onPick: () => void;
}

// Compact drop invite shown under the always-visible toolbar. The mascot is
// CSS shapes only — no image assets.
export default function EmptyState({ onPick }: Props) {
  return (
    <div className="empty">
      <button type="button" className="mascot" onClick={onPick} aria-label="Pick a PDF">
        <span className="mascot-eye left" aria-hidden="true" />
        <span className="mascot-eye right" aria-hidden="true" />
        <span className="mascot-cheek left" aria-hidden="true" />
        <span className="mascot-cheek right" aria-hidden="true" />
        <span className="mascot-smile" aria-hidden="true" />
      </button>

      <h1 className="empty-title">Drop a PDF here — or click + Add PDF</h1>

      <div className="privacy-chip">
        <span
          className="status-dot"
          style={{ background: 'var(--c-go)' }}
          aria-hidden="true"
        />
        Stays on your device — nothing ever gets uploaded
      </div>
    </div>
  );
}
