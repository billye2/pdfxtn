import { useState } from 'react';
import Modal from './Modal';
import SegmentedControl from './SegmentedControl';
import { ChevronDown } from './icons';
import { interleave, type PageDescriptor } from '../lib/pageModel';
import './MixDialog.css';

export interface MixGroup {
  docId: string;
  name: string;
  pages: PageDescriptor[];
}

export interface UnmixOptions {
  reverseSecond: boolean;
  markSplit: boolean;
}

interface Props {
  groups: MixGroup[];
  /** Total page count — un-mix operates on the current page order, not groups. */
  pageCount: number;
  onMix: (pages: PageDescriptor[]) => void;
  onUnmix: (opts: UnmixOptions) => void;
  onCancel: () => void;
}

export default function MixDialog({
  groups,
  pageCount,
  onMix,
  onUnmix,
  onCancel,
}: Props) {
  // Mixing needs ≥2 source documents; with one doc, un-mixing is the only move.
  const [mode, setMode] = useState<'mix' | 'unmix'>(groups.length < 2 ? 'unmix' : 'mix');
  const [reverseSecond, setReverseSecond] = useState(false);
  const [markSplit, setMarkSplit] = useState(true);
  // Local ordering of groups + a reverse flag per group (keyed by docId).
  const [order, setOrder] = useState<number[]>(groups.map((_, i) => i));
  const [reverse, setReverse] = useState<Record<string, boolean>>(() =>
    // Default to the common case: two docs, reverse the second (backs).
    groups.length === 2 ? { [groups[1].docId]: true } : {},
  );

  function move(pos: number, dir: -1 | 1) {
    const next = order.slice();
    const target = pos + dir;
    if (target < 0 || target >= next.length) return;
    [next[pos], next[target]] = [next[target], next[pos]];
    setOrder(next);
  }

  function toggleReverse(docId: string) {
    setReverse((r) => ({ ...r, [docId]: !r[docId] }));
  }

  function applyPreset() {
    // "Double-sided scan": keep order, reverse only the 2nd document.
    setOrder(groups.map((_, i) => i));
    setReverse(groups.length >= 2 ? { [groups[1].docId]: true } : {});
  }

  function mix() {
    const orderedGroups = order.map((i) => {
      const g = groups[i];
      return reverse[g.docId] ? g.pages.slice().reverse() : g.pages;
    });
    onMix(interleave(orderedGroups));
  }

  const frontCount = Math.ceil(pageCount / 2);

  return (
    <Modal title="Mix / un-mix pages" onClose={onCancel} className="mix-modal">
      <SegmentedControl
        ariaLabel="Mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'mix', label: 'Mix', disabled: groups.length < 2 },
          { value: 'unmix', label: 'Un-mix', disabled: pageCount < 2 },
        ]}
      />

      {mode === 'unmix' ? (
        <>
          <p className="modal-help">
            Undo an interleave: pull every other page out into a second half — fronts
            first, then backs. Handy for splitting a double-sided scan back apart.
          </p>
          <p className="modal-help">
            Pages 1–{frontCount}, then {frontCount + 1}–{pageCount}.
          </p>
          <div className="unmix-options">
            <label className="mix-reverse">
              <input
                type="checkbox"
                checked={reverseSecond}
                onChange={() => setReverseSecond((v) => !v)}
              />
              Reverse the second half
            </label>
            <label className="mix-reverse">
              <input
                type="checkbox"
                checked={markSplit}
                onChange={() => setMarkSplit((v) => !v)}
              />
              Split into two files
            </label>
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="btn-go"
              onClick={() => onUnmix({ reverseSecond, markSplit })}
            >
              Un-mix pages
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="modal-help">
            Combine documents by taking pages alternately. Perfect for a stack scanned
            double-sided on a single-sided feeder: scan the fronts, flip the stack and
            scan the backs, then reverse the backs here.
          </p>

          <div className="mix-list">
            {order.map((gi, pos) => {
              const g = groups[gi];
              return (
                <div className="mix-row" key={g.docId}>
                  <span className="mix-seq">{pos + 1}</span>
                  <span className="mix-name" title={g.name}>
                    {g.name}
                    <span className="mix-count">{g.pages.length} pages</span>
                  </span>
                  <label className="mix-reverse">
                    <input
                      type="checkbox"
                      checked={!!reverse[g.docId]}
                      onChange={() => toggleReverse(g.docId)}
                    />
                    Reverse
                  </label>
                  <span className="mix-move">
                    <button
                      className="btn-secondary icon-btn"
                      title="Move up"
                      disabled={pos === 0}
                      onClick={() => move(pos, -1)}
                    >
                      <ChevronDown size={16} style={{ transform: 'rotate(180deg)' }} />
                    </button>
                    <button
                      className="btn-secondary icon-btn"
                      title="Move down"
                      disabled={pos === order.length - 1}
                      onClick={() => move(pos, 1)}
                    >
                      <ChevronDown size={16} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>

          {groups.length === 2 && (
            <button className="btn-secondary mix-preset" onClick={applyPreset}>
              Use double-sided scan preset
            </button>
          )}

          <div className="modal-footer">
            <button className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button className="btn-go" onClick={mix} disabled={groups.length < 2}>
              Mix pages
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
