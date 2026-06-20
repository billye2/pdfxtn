interface Props {
  onPick: () => void;
}

// All decoration is CSS shapes — no image assets.
export default function EmptyState({ onPick }: Props) {
  return (
    <div className="empty">
      <div className="decor coin" />
      <div className="decor star" />
      <div className="decor dot1" />
      <div className="decor dot2" />

      <div className="mascot" onClick={onPick} title="Pick a PDF" role="button">
        <span className="mascot-eye left" />
        <span className="mascot-eye right" />
        <span className="mascot-cheek left" />
        <span className="mascot-cheek right" />
        <span className="mascot-smile" />
      </div>

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
        <span className="status-dot" style={{ background: 'var(--c-go)' }} />
        Stays on your device — nothing ever gets uploaded
      </div>
    </div>
  );
}
