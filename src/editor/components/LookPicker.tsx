import { ChevronDown, Check } from './icons';
import { LOOKS, LOOK_ORDER, paletteDots, type LookId } from '../themes';

interface Props {
  look: LookId;
  open: boolean;
  onToggle: () => void;
  onPick: (look: LookId) => void;
  onClose: () => void;
}

function Dots({ look }: { look: LookId }) {
  return (
    <span className="palette">
      {paletteDots(look).map((c, i) => (
        <span key={i} className="palette-dot" style={{ background: c }} />
      ))}
    </span>
  );
}

export default function LookPicker({ look, open, onToggle, onPick, onClose }: Props) {
  return (
    <div className="look-picker">
      <button className="btn-secondary look-trigger" onClick={onToggle}>
        <Dots look={look} />
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
                <Dots look={id} />
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
