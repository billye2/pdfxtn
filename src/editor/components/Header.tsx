import { Download, HelpCircle, Keyboard, Loader2 } from './icons';
import LookPicker from './LookPicker';
import type { LookId } from '../themes';
import type { AppState } from '../store';
import './Header.css';

interface Props {
  appState: AppState;
  pageCount: number;
  selectedCount: number;
  look: LookId;
  lookMenuOpen: boolean;
  canSave: boolean;
  saving: boolean;
  onToggleLookMenu: () => void;
  onPickLook: (look: LookId) => void;
  onCloseLookMenu: () => void;
  onHelp: () => void;
  onShortcuts: () => void;
  onSave: () => void;
}

function statusFor(state: AppState, pages: number, selected: number) {
  if (state === 'loading') return { label: 'Loading…', dot: 'var(--c-add)' };
  if (state === 'editor') {
    const label =
      `${pages} page${pages === 1 ? '' : 's'}` +
      (selected > 0 ? ` · ${selected} picked` : '');
    return { label, dot: 'var(--c-go)' };
  }
  return { label: 'Ready when you are', dot: 'var(--sub)' };
}

export default function Header(props: Props) {
  const status = statusFor(props.appState, props.pageCount, props.selectedCount);

  return (
    <header className="header">
      <div className="brand">
        <span className="brand-text">
          <span className="brand-title">PDF Mana</span>
          <span className="brand-sub">Merge · Arrange · Nip · Adjust</span>
        </span>
      </div>

      <div className="status">
        <span className="status-dot" style={{ background: status.dot }} />
        <span className="status-label">{status.label}</span>
      </div>

      <div className="header-controls">
        <button className="btn-secondary icon-btn" title="Help" onClick={props.onHelp}>
          <HelpCircle size={18} />
        </button>
        <button
          className="btn-secondary icon-btn"
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
          onClick={props.onShortcuts}
        >
          <Keyboard size={18} />
        </button>
        <LookPicker
          look={props.look}
          open={props.lookMenuOpen}
          onToggle={props.onToggleLookMenu}
          onPick={props.onPickLook}
          onClose={props.onCloseLookMenu}
        />
        <button
          className="btn-go save-btn"
          disabled={!props.canSave || props.saving}
          onClick={props.onSave}
        >
          {props.saving ? <Loader2 size={17} className="spin" /> : <Download size={17} />}
          {props.saving ? 'Saving…' : 'Save PDF'}
        </button>
      </div>
    </header>
  );
}
