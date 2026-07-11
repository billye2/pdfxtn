import Modal from './Modal';
import './ShortcutsDialog.css';

interface Props {
  onClose: () => void;
}

// One row per shortcut: the key chips, then what they do. Kept in sync by
// hand with useKeyboardShortcuts (the global map) — update both together.
interface Row {
  keys: string[];
  or?: string[];
  does: string;
}

const GROUPS: Array<{ title: string; rows: Row[] }> = [
  {
    title: 'Picking pages',
    rows: [
      { keys: ['Tab'], does: 'move between pages (and buttons)' },
      { keys: ['Enter'], does: 'pick or unpick the focused page' },
      { keys: ['Shift', 'Enter'], does: 'pick a range up to the focused page' },
      { keys: ['Cmd/Ctrl', 'A'], does: 'pick every page' },
      { keys: ['Esc'], does: 'clear the picked pages' },
    ],
  },
  {
    title: 'Acting on picked pages',
    rows: [
      { keys: ['R'], does: 'rotate clockwise (Shift+R for counter-clockwise)' },
      { keys: ['C'], does: 'crop' },
      { keys: ['B'], does: 'insert a blank page after them' },
      { keys: ['K'], does: 'keep only these pages' },
      { keys: ['S'], does: 'add split marks after them' },
      { keys: ['Delete'], or: ['Backspace'], does: 'delete them' },
      { keys: ['Cmd/Ctrl', 'D'], does: 'duplicate them' },
      { keys: ['←'], or: ['→'], does: 'move a single picked page one spot' },
      { keys: ['Space'], does: 'preview a single picked page up close' },
    ],
  },
  {
    title: 'In the preview',
    rows: [
      { keys: ['←'], or: ['→'], does: 'previous / next page' },
      { keys: ['Space'], or: ['Esc'], does: 'close the preview' },
    ],
  },
  {
    title: 'Anywhere',
    rows: [
      { keys: ['Cmd/Ctrl', 'Z'], does: 'undo' },
      { keys: ['Cmd/Ctrl', 'Shift', 'Z'], or: ['Cmd/Ctrl', 'Y'], does: 'redo' },
      { keys: ['?'], does: 'open this cheat sheet' },
    ],
  },
];

const Keys = ({ keys }: { keys: string[] }) => (
  <span className="sc-keys">
    {keys.map((k, i) => (
      <kbd key={i}>{k}</kbd>
    ))}
  </span>
);

export default function ShortcutsDialog({ onClose }: Props) {
  return (
    <Modal title="Keyboard shortcuts" className="shortcuts-modal" onClose={onClose}>
      {/* The list scrolls on its own so Modal's initial focus can't drag the
          whole dialog to the bottom; tabIndex makes the region keyboard-
          scrollable (and satisfies axe scrollable-region-focusable) and, as
          the first focusable, it takes Modal's initial focus — at the top. */}
      <div className="sc-scroll" tabIndex={0}>
        <div className="sc-groups">
          {GROUPS.map((g) => (
            <section key={g.title} className="sc-group">
              <h3>{g.title}</h3>
              {g.rows.map((r, i) => (
                <div key={i} className="sc-row">
                  <span className="sc-combo">
                    <Keys keys={r.keys} />
                    {r.or && <span className="sc-or">or</span>}
                    {r.or && <Keys keys={r.or} />}
                  </span>
                  <span className="sc-does">{r.does}</span>
                </div>
              ))}
            </section>
          ))}
        </div>
        <p className="sc-mouse">
          With a mouse: drag a page to reorder, Shift-click to pick a range,
          Cmd/Ctrl-click to add or remove one, double-click to preview.
        </p>
      </div>
      <div className="modal-footer">
        <button className="btn-go" onClick={onClose}>
          Got it
        </button>
      </div>
    </Modal>
  );
}
