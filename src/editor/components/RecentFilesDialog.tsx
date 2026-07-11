import Modal from './Modal';
import { Pin, X } from './icons';
import type { RecentMeta } from '../lib/persist';
import './RecentFilesDialog.css';

interface Props {
  recents: RecentMeta[];
  remember: boolean;
  onOpen: (meta: RecentMeta) => void;
  onTogglePin: (hash: string) => void;
  onRemove: (hash: string) => void;
  onClearAll: () => void;
  onToggleRemember: () => void;
  onClose: () => void;
}

function metaLine(r: RecentMeta): string {
  const date = new Date(r.openedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return `${r.pageCount} page${r.pageCount === 1 ? '' : 's'} · ${date}`;
}

/**
 * The pin-button dialog: files opened before (pinned first, then newest
 * first), one click to open again. The row body is one button and the
 * pin/remove controls are siblings (never nested), so all three stay real
 * keyboard/screen-reader targets. Pinned entries are never auto-evicted.
 */
export default function RecentFilesDialog(props: Props) {
  return (
    <Modal title="Previously opened" className="recents-modal" onClose={props.onClose}>
      {props.recents.length === 0 ? (
        <p className="recents-empty">
          {props.remember
            ? 'Files you open will show up here, ready to reopen with one click.'
            : 'Remembering is off — files you open are not kept for reopening.'}
        </p>
      ) : (
        <ul className="recents-list">
          {props.recents.map((r) => (
            <li key={r.hash} className="recent-row">
              <button
                type="button"
                className="recent-open"
                title={`Open ${r.name}`}
                onClick={() => props.onOpen(r)}
              >
                {r.thumb ? (
                  <img className="recent-thumb" src={r.thumb} alt="" />
                ) : (
                  <span className="recent-thumb recent-thumb-blank" aria-hidden="true" />
                )}
                <span className="recent-text">
                  <span className="recent-name">{r.name}</span>
                  <span className="recent-meta">{metaLine(r)}</span>
                </span>
              </button>
              <button
                type="button"
                className={`btn-secondary icon-btn recent-pin${r.pinned ? ' pinned' : ''}`}
                aria-pressed={r.pinned ?? false}
                aria-label={`Pin ${r.name}`}
                title={
                  r.pinned
                    ? 'Unpin (can be auto-removed again)'
                    : 'Pin (never auto-removed)'
                }
                onClick={() => props.onTogglePin(r.hash)}
              >
                <Pin size={15} />
              </button>
              <button
                type="button"
                className="btn-secondary icon-btn recent-remove"
                aria-label={`Remove ${r.name} from this list`}
                title="Remove from this list"
                onClick={() => props.onRemove(r.hash)}
              >
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="recents-footer">
        <label className="recents-remember">
          <input
            type="checkbox"
            checked={props.remember}
            onChange={props.onToggleRemember}
          />
          Remember opened files
        </label>
        {props.recents.length > 0 && (
          <button type="button" className="btn-secondary" onClick={props.onClearAll}>
            Clear all
          </button>
        )}
      </div>
      <p className="recents-caption">
        Kept only on this device — never uploaded. Pinned files stay until you remove
        them.
      </p>
    </Modal>
  );
}
