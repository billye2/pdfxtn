interface Props {
  onPick: () => void;
}

// All decoration is CSS shapes — no image assets.
export default function EmptyState({ onPick }: Props) {
  return (
    <div className="empty">
      <div className="decor coin" aria-hidden="true" />
      <div className="decor star" aria-hidden="true" />
      <div className="decor dot1" aria-hidden="true" />
      <div className="decor dot2" aria-hidden="true" />

      <button type="button" className="mascot" onClick={onPick} aria-label="Pick a PDF">
        <span className="mascot-eye left" aria-hidden="true" />
        <span className="mascot-eye right" aria-hidden="true" />
        <span className="mascot-cheek left" aria-hidden="true" />
        <span className="mascot-cheek right" aria-hidden="true" />
        <span className="mascot-smile" aria-hidden="true" />
      </button>

      <h1 className="empty-title">Let's fix up your PDF!</h1>
      <p className="empty-body">
        Drag pages around, spin them, snip them, and save a brand-new file. Super easy —
        and everything stays right here on your computer.
      </p>

      <div className="empty-buttons">
        <button className="btn-add big" onClick={onPick}>
          + Pick a PDF
        </button>
      </div>

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
