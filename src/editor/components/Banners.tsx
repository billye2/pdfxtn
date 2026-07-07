interface Props {
  /** Page count of the restorable session, or null to hide the restore offer. */
  restoreCount: number | null;
  onRestore: () => void;
  onDiscard: () => void;
  /** Hostname of the handed-off tab PDF, or null to hide the pending offer. */
  pendingHost: string | null;
  onLoadPending: () => void;
  onDismissPending: () => void;
}

/** The two offer banners under the toolbar: restore-previous-session and
 * load-the-tab's-PDF. Pure presentation — the flows live in
 * useSessionRestore / usePendingSource. */
export default function Banners({
  restoreCount,
  onRestore,
  onDiscard,
  pendingHost,
  onLoadPending,
  onDismissPending,
}: Props) {
  return (
    <>
      {restoreCount !== null && (
        <div className="pending-banner restore-banner">
          <span className="pending-text">
            Restore your previous work?{' '}
            <strong>
              {restoreCount} page{restoreCount === 1 ? '' : 's'}
            </strong>{' '}
            from your last session.
          </span>
          <button className="btn-go pending-btn" onClick={onRestore}>
            Restore
          </button>
          <button className="btn-secondary pending-btn" onClick={onDiscard}>
            Discard
          </button>
        </div>
      )}

      {pendingHost !== null && (
        <div className="pending-banner">
          <span className="pending-text">
            A PDF from <strong>{pendingHost}</strong> is ready to load.
          </span>
          <button className="btn-go pending-btn" onClick={onLoadPending}>
            Load PDF
          </button>
          <button className="btn-secondary pending-btn" onClick={onDismissPending}>
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
