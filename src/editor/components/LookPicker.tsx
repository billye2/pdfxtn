import { useEffect } from 'react';
import { ChevronDown, Check } from './icons';
import { LOOKS, LOOK_ORDER, type LookId } from '../themes';
import './LookPicker.css';

interface Props {
  look: LookId;
  open: boolean;
  onToggle: () => void;
  onPick: (look: LookId) => void;
  onClose: () => void;
}

export default function LookPicker({ look, open, onToggle, onPick, onClose }: Props) {
  // Close the menu on Escape while it's open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className="look-picker">
      <button
        className="btn-secondary look-trigger"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="look-name">{LOOKS[look].name}</span>
        <ChevronDown size={14} className="chev" />
      </button>

      {open && (
        <>
          <div className="look-backdrop" onClick={onClose} />
          <div className="look-menu">
            <div className="look-caption">PICK A LOOK</div>
            {LOOK_ORDER.map((id) => (
              <button
                key={id}
                className={`look-option${id === look ? ' active' : ''}`}
                onClick={() => onPick(id)}
              >
                <span className="look-name">{LOOKS[id].name}</span>
                {id === look && <Check size={16} className="look-check" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
