import './EmptyState.css';

interface Props {
  onPick: () => void;
}

// Persistent dashed drop box filling most of the area under the toolbar. The
// whole zone opens the picker on click — the mascot button is the keyboard/
// screen-reader control and its click simply bubbles to the zone's handler.
// Actual drops land on `.app` (App.tsx); the box is a visual target only.
// The mascot is CSS shapes — no image assets.
export default function EmptyState({ onPick }: Props) {
  return (
    <div className="empty">
      <div className="drop-zone" onClick={onPick}>
        <button type="button" className="mascot" aria-label="Pick a PDF">
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
    </div>
  );
}
