import Modal from './Modal';
import { X } from './icons';
import type { RecentMeta } from '../lib/persist';
import './RecentFilesDialog.css';

interface Props {
  recents: RecentMeta[];
  onOpen: (meta: RecentMeta) => void;
  onRemove: (hash: string) => void;
  onClearAll: () => void;
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
 * The star-button dialog: files opened before, newest first, one click to
 * open again. The row body is one button and the remove control a sibling
 * button (never nested), so both stay real keyboard/screen-reader targets.
 */
export default function RecentFilesDialog(props: Props) {
  return (
    <Modal title="Previously opened" className="recents-modal" onClose={props.onClose}>
      {props.recents.length === 0 ? (
        <p className="recents-empty">
          Files you open will show up here, ready to reopen with one click.
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
        <span className="recents-caption">
          Kept only on this device — never uploaded.
        </span>
        {props.recents.length > 0 && (
          <button type="button" className="btn-secondary" onClick={props.onClearAll}>
            Clear all
          </button>
        )}
      </div>
    </Modal>
  );
}
