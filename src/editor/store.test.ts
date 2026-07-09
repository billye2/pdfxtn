import { describe, it, expect } from 'vitest';
import { reducer, initialHistory, type HistoryState } from './store';
import type { PageDescriptor, Rotation } from './lib/pageModel';

// Build a simple page list "p0".."pN-1" all from the same source doc.
function makePages(n: number, docId = 'd1'): PageDescriptor[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    docId,
    pageIndex: i,
    rotation: 0 as Rotation,
  }));
}

// Seed a history whose present holds `n` pages and nothing else.
function historyWith(n: number): HistoryState {
  return reducer(initialHistory, { type: 'addPages', pages: makePages(n) });
}

const ids = (h: HistoryState) => h.present.pages.map((p) => p.id);

describe('addPages', () => {
  it('appends pages and pushes history', () => {
    const h = historyWith(3);
    expect(ids(h)).toEqual(['p0', 'p1', 'p2']);
    expect(h.past).toHaveLength(1);
    expect(h.future).toHaveLength(0);
  });

  it('appends onto an existing list', () => {
    const h = reducer(historyWith(2), {
      type: 'addPages',
      pages: [{ id: 'x', docId: 'd2', pageIndex: 0, rotation: 0 }],
    });
    expect(ids(h)).toEqual(['p0', 'p1', 'x']);
  });
});

describe('restore', () => {
  it('replaces the session and clears history', () => {
    // Build up some history, then restore a saved session over it.
    let h = historyWith(2);
    h = reducer(h, { type: 'reorder', from: 0, to: 1 });
    expect(h.past.length).toBeGreaterThan(0);

    h = reducer(h, {
      type: 'restore',
      pages: makePages(3, 'saved'),
      splitMarks: ['p1'],
    });
    expect(ids(h)).toEqual(['p0', 'p1', 'p2']);
    expect(h.present.splitMarks).toEqual(new Set(['p1']));
    expect(h.present.selected.size).toBe(0);
    // Nothing to undo back into — a restore is a fresh start.
    expect(h.past).toHaveLength(0);
    expect(h.future).toHaveLength(0);
  });
});

describe('reorder', () => {
  it('moves a page and records history', () => {
    const h = reducer(historyWith(3), { type: 'reorder', from: 0, to: 2 });
    expect(ids(h)).toEqual(['p1', 'p2', 'p0']);
    expect(h.past).toHaveLength(2); // addPages + reorder
  });

  it('keeps the page order when from === to', () => {
    const h = reducer(historyWith(3), { type: 'reorder', from: 1, to: 1 });
    expect(ids(h)).toEqual(['p0', 'p1', 'p2']);
  });
});

describe('selection', () => {
  it('toggleSelect replaces selection by default', () => {
    let h = historyWith(3);
    h = reducer(h, { type: 'toggleSelect', id: 'p0', additive: false });
    h = reducer(h, { type: 'toggleSelect', id: 'p2', additive: false });
    expect([...h.present.selected]).toEqual(['p2']);
  });

  it('toggleSelect additive adds and removes', () => {
    let h = historyWith(3);
    h = reducer(h, { type: 'toggleSelect', id: 'p0', additive: true });
    h = reducer(h, { type: 'toggleSelect', id: 'p1', additive: true });
    expect([...h.present.selected].sort()).toEqual(['p0', 'p1']);
    h = reducer(h, { type: 'toggleSelect', id: 'p0', additive: true });
    expect([...h.present.selected]).toEqual(['p1']);
  });

  it('selectAll selects every page', () => {
    const h = reducer(historyWith(3), { type: 'selectAll' });
    expect([...h.present.selected].sort()).toEqual(['p0', 'p1', 'p2']);
  });

  it('clearSelection empties selection', () => {
    let h = reducer(historyWith(3), { type: 'selectAll' });
    h = reducer(h, { type: 'clearSelection' });
    expect(h.present.selected.size).toBe(0);
  });

  it('selectRangeTo selects from the last-selected anchor to target', () => {
    let h = historyWith(5);
    h = reducer(h, { type: 'toggleSelect', id: 'p1', additive: false });
    h = reducer(h, { type: 'selectRangeTo', id: 'p3' });
    expect([...h.present.selected].sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('selectRangeTo works backwards too', () => {
    let h = historyWith(5);
    h = reducer(h, { type: 'toggleSelect', id: 'p3', additive: false });
    h = reducer(h, { type: 'selectRangeTo', id: 'p1' });
    expect([...h.present.selected].sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('selection changes never grow the undo stack', () => {
    let h = historyWith(3); // past length 1
    const before = h.past.length;
    h = reducer(h, { type: 'selectAll' });
    h = reducer(h, { type: 'toggleSelect', id: 'p0', additive: true });
    h = reducer(h, { type: 'selectRangeTo', id: 'p2' });
    h = reducer(h, { type: 'clearSelection' });
    expect(h.past.length).toBe(before);
  });
});

describe('deleteSelected / extractSelected', () => {
  it('deleteSelected removes selected pages and clears selection', () => {
    let h = historyWith(4);
    h = reducer(h, { type: 'toggleSelect', id: 'p1', additive: true });
    h = reducer(h, { type: 'toggleSelect', id: 'p2', additive: true });
    h = reducer(h, { type: 'deleteSelected' });
    expect(ids(h)).toEqual(['p0', 'p3']);
    expect(h.present.selected.size).toBe(0);
  });

  it('extractSelected keeps only selected pages, in page order', () => {
    let h = historyWith(4);
    h = reducer(h, { type: 'toggleSelect', id: 'p2', additive: true });
    h = reducer(h, { type: 'toggleSelect', id: 'p0', additive: true });
    h = reducer(h, { type: 'extractSelected' });
    expect(ids(h)).toEqual(['p0', 'p2']);
  });

  it('extractSelected with no selection is a no-op', () => {
    const start = historyWith(3);
    const h = reducer(start, { type: 'extractSelected' });
    expect(h).toBe(start);
  });
});

describe('duplicateSelected', () => {
  it('inserts copies after the originals and selects the copies', () => {
    let h = historyWith(3);
    h = reducer(h, { type: 'toggleSelect', id: 'p1', additive: false });
    h = reducer(h, { type: 'duplicateSelected' });
    expect(ids(h)).toEqual(['p0', 'p1', h.present.pages[2].id, 'p2']);
    expect(h.present.selected).toEqual(new Set([h.present.pages[2].id]));
    expect(h.past).toHaveLength(2); // addPages + duplicate
  });

  it('preserves split marks', () => {
    let h = reducer(historyWith(3), { type: 'toggleSplitMark', id: 'p0' });
    h = reducer(h, { type: 'toggleSelect', id: 'p2', additive: false });
    h = reducer(h, { type: 'duplicateSelected' });
    expect(h.present.splitMarks).toEqual(new Set(['p0']));
  });

  it('is a no-op with nothing selected', () => {
    const start = historyWith(3);
    expect(reducer(start, { type: 'duplicateSelected' })).toBe(start);
  });

  it('undo removes the copies and restores the selection state', () => {
    let h = historyWith(2);
    h = reducer(h, { type: 'toggleSelect', id: 'p0', additive: false });
    h = reducer(h, { type: 'duplicateSelected' });
    h = reducer(h, { type: 'undo' });
    expect(ids(h)).toEqual(['p0', 'p1']);
  });
});

describe('reverse', () => {
  it('reverses all pages when fewer than 2 are selected', () => {
    const h = reducer(historyWith(3), { type: 'reverse' });
    expect(ids(h)).toEqual(['p2', 'p1', 'p0']);
    expect(h.past).toHaveLength(2);
  });

  it('reverses only the selected pages within their slots', () => {
    let h = historyWith(4);
    h = reducer(h, { type: 'toggleSelect', id: 'p0', additive: true });
    h = reducer(h, { type: 'toggleSelect', id: 'p3', additive: true });
    h = reducer(h, { type: 'reverse' });
    expect(ids(h)).toEqual(['p3', 'p1', 'p2', 'p0']);
  });

  it('is a history no-op on a single page', () => {
    const start = historyWith(1);
    expect(reducer(start, { type: 'reverse' })).toBe(start);
  });
});

describe('unmix', () => {
  it('reorders to fronts-then-backs and marks the split between halves', () => {
    const h = reducer(historyWith(5), {
      type: 'unmix',
      reverseSecond: false,
      markSplit: true,
    });
    expect(ids(h)).toEqual(['p0', 'p2', 'p4', 'p1', 'p3']);
    expect(h.present.splitMarks).toEqual(new Set(['p4'])); // last front
    expect(h.present.selected.size).toBe(0);
  });

  it('reverses the second half when asked', () => {
    const h = reducer(historyWith(4), {
      type: 'unmix',
      reverseSecond: true,
      markSplit: false,
    });
    expect(ids(h)).toEqual(['p0', 'p2', 'p3', 'p1']);
    expect(h.present.splitMarks.size).toBe(0);
  });

  it('clears pre-existing split marks when markSplit is false', () => {
    let h = reducer(historyWith(4), { type: 'toggleSplitMark', id: 'p1' });
    h = reducer(h, { type: 'unmix', reverseSecond: false, markSplit: false });
    expect(h.present.splitMarks.size).toBe(0);
  });

  it('a single undo restores both the order and the marks', () => {
    let h = reducer(historyWith(4), { type: 'toggleSplitMark', id: 'p1' });
    h = reducer(h, { type: 'unmix', reverseSecond: false, markSplit: true });
    h = reducer(h, { type: 'undo' });
    expect(ids(h)).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(h.present.splitMarks).toEqual(new Set(['p1']));
  });

  it('is a no-op on fewer than 2 pages', () => {
    const start = historyWith(1);
    expect(reducer(start, { type: 'unmix', reverseSecond: false, markSplit: true })).toBe(
      start,
    );
  });
});

describe('insertPages', () => {
  const blank = (id: string): PageDescriptor => ({
    id,
    docId: 'blank1',
    pageIndex: 0,
    rotation: 0,
  });

  it('splices pages in at the index and selects them', () => {
    const h = reducer(historyWith(3), {
      type: 'insertPages',
      pages: [blank('b0')],
      at: 1,
    });
    expect(ids(h)).toEqual(['p0', 'b0', 'p1', 'p2']);
    expect(h.present.selected).toEqual(new Set(['b0']));
  });

  it('clamps an out-of-range index', () => {
    const h = reducer(historyWith(2), {
      type: 'insertPages',
      pages: [blank('b0')],
      at: 99,
    });
    expect(ids(h)).toEqual(['p0', 'p1', 'b0']);
  });

  it('preserves split marks', () => {
    let h = reducer(historyWith(3), { type: 'toggleSplitMark', id: 'p1' });
    h = reducer(h, { type: 'insertPages', pages: [blank('b0')], at: 0 });
    expect(h.present.splitMarks).toEqual(new Set(['p1']));
  });

  it('is a no-op with an empty page list', () => {
    const start = historyWith(2);
    expect(reducer(start, { type: 'insertPages', pages: [], at: 1 })).toBe(start);
  });
});

describe('rotation', () => {
  it('rotateSelected turns only selected pages', () => {
    let h = historyWith(3);
    h = reducer(h, { type: 'toggleSelect', id: 'p1', additive: true });
    h = reducer(h, { type: 'rotateSelected', delta: 90 });
    expect(h.present.pages.map((p) => p.rotation)).toEqual([0, 90, 0]);
  });

  it('rotateOne turns a single page by id', () => {
    const h = reducer(historyWith(2), { type: 'rotateOne', id: 'p0', delta: 180 });
    expect(h.present.pages.map((p) => p.rotation)).toEqual([180, 0]);
  });
});

describe('crop', () => {
  it('applyCrop to all sets crop on every page', () => {
    const crop = { x: 0.1, y: 0.1, w: 0.5, h: 0.5 };
    const h = reducer(historyWith(2), { type: 'applyCrop', crop, scope: 'all' });
    expect(h.present.pages.every((p) => p.crop)).toBe(true);
  });

  it('applyCrop clamps out-of-bounds rectangles', () => {
    const crop = { x: 0.8, y: 0.8, w: 0.5, h: 0.5 }; // overflows the unit square
    const h = reducer(historyWith(1), { type: 'applyCrop', crop, scope: 'all' });
    const c = h.present.pages[0].crop!;
    expect(c.x + c.w).toBeCloseTo(1);
    expect(c.y + c.h).toBeCloseTo(1);
  });

  it('applyCrop with undefined clears the crop', () => {
    let h = reducer(historyWith(2), {
      type: 'applyCrop',
      crop: { x: 0, y: 0, w: 1, h: 1 },
      scope: 'all',
    });
    h = reducer(h, { type: 'applyCrop', crop: undefined, scope: 'all' });
    expect(h.present.pages.every((p) => p.crop === undefined)).toBe(true);
  });
});

describe('split marks', () => {
  it('toggleSplitMark adds and removes a mark', () => {
    let h = reducer(historyWith(3), { type: 'toggleSplitMark', id: 'p1' });
    expect([...h.present.splitMarks]).toEqual(['p1']);
    h = reducer(h, { type: 'toggleSplitMark', id: 'p1' });
    expect(h.present.splitMarks.size).toBe(0);
  });

  it('splitEveryN marks the boundary pages', () => {
    const h = reducer(historyWith(5), { type: 'splitEveryN', n: 2 });
    // Marks after page index 1 and 3 (ids p1, p3); no trailing mark on the last.
    expect([...h.present.splitMarks].sort()).toEqual(['p1', 'p3']);
  });
});

describe('setPages', () => {
  it('replaces the list and resets derived state', () => {
    let h = historyWith(3);
    h = reducer(h, { type: 'selectAll' });
    h = reducer(h, { type: 'toggleSplitMark', id: 'p0' });
    h = reducer(h, { type: 'setPages', pages: makePages(2, 'd9') });
    expect(ids(h)).toEqual(['p0', 'p1']);
    expect(h.present.selected.size).toBe(0);
    expect(h.present.splitMarks.size).toBe(0);
  });
});

describe('undo / redo', () => {
  it('undo restores the previous present', () => {
    let h = reducer(historyWith(3), { type: 'reorder', from: 0, to: 2 });
    expect(ids(h)).toEqual(['p1', 'p2', 'p0']);
    h = reducer(h, { type: 'undo' });
    expect(ids(h)).toEqual(['p0', 'p1', 'p2']);
  });

  it('redo reapplies an undone change', () => {
    let h = reducer(historyWith(3), { type: 'reorder', from: 0, to: 2 });
    h = reducer(h, { type: 'undo' });
    h = reducer(h, { type: 'redo' });
    expect(ids(h)).toEqual(['p1', 'p2', 'p0']);
  });

  it('a new edit clears the redo stack', () => {
    let h = reducer(historyWith(3), { type: 'reorder', from: 0, to: 1 });
    h = reducer(h, { type: 'undo' });
    expect(h.future.length).toBe(1);
    h = reducer(h, { type: 'rotateOne', id: 'p0', delta: 90 });
    expect(h.future.length).toBe(0);
  });

  it('undo on empty history is a no-op', () => {
    const h = reducer(initialHistory, { type: 'undo' });
    expect(h).toBe(initialHistory);
  });

  it('redo on empty future is a no-op', () => {
    const start = historyWith(2);
    const h = reducer(start, { type: 'redo' });
    expect(h).toBe(start);
  });

  it('round-trips through multiple edits', () => {
    let h = historyWith(3);
    h = reducer(h, { type: 'reorder', from: 0, to: 2 }); // p1 p2 p0
    h = reducer(h, { type: 'rotateOne', id: 'p0', delta: 90 });
    h = reducer(h, { type: 'undo' });
    h = reducer(h, { type: 'undo' });
    expect(ids(h)).toEqual(['p0', 'p1', 'p2']);
    expect(h.present.pages.every((p) => p.rotation === 0)).toBe(true);
  });
});
