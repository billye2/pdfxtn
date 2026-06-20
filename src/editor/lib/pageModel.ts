// The editor's source of truth is an ordered list of PageDescriptors. Every
// operation (reorder/rotate/delete/crop/split) is a pure transform over this
// list, which keeps things non-destructive and trivially undoable.

export type Rotation = 0 | 90 | 180 | 270;

/**
 * A normalized crop rectangle expressed as fractions [0..1] of the *unrotated*
 * page box, with the origin at the top-left. Stored normalized so it survives
 * thumbnail scaling; converted to PDF points at export time.
 */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PageDescriptor {
  /** Stable id for React keys / dnd-kit and for selection tracking. */
  id: string;
  /** Which loaded source document this page comes from. */
  docId: string;
  /** Zero-based page index within the source document. */
  pageIndex: number;
  rotation: Rotation;
  crop?: CropRect;
}

let idCounter = 0;
export function nextPageId(): string {
  idCounter += 1;
  return `p${idCounter}`;
}

export function rotateOne(r: Rotation, delta: 90 | -90 | 180): Rotation {
  return (((r + delta) % 360) + 360) % 360 as Rotation;
}

/** Move the page at `from` to `to` (array-move). Returns a new array. */
export function reorder(
  pages: PageDescriptor[],
  from: number,
  to: number,
): PageDescriptor[] {
  if (from === to || from < 0 || to < 0) return pages;
  const next = pages.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function deleteSelected(
  pages: PageDescriptor[],
  selected: ReadonlySet<string>,
): PageDescriptor[] {
  return pages.filter((p) => !selected.has(p.id));
}

export function rotateSelected(
  pages: PageDescriptor[],
  selected: ReadonlySet<string>,
  delta: 90 | -90 | 180,
): PageDescriptor[] {
  return pages.map((p) =>
    selected.has(p.id) ? { ...p, rotation: rotateOne(p.rotation, delta) } : p,
  );
}

/**
 * Apply one crop rectangle to either all pages or just the selected ones.
 * Passing `undefined` clears the crop.
 */
export function applyCrop(
  pages: PageDescriptor[],
  crop: CropRect | undefined,
  scope: 'all' | 'selected',
  selected: ReadonlySet<string>,
): PageDescriptor[] {
  return pages.map((p) => {
    const inScope = scope === 'all' || selected.has(p.id);
    return inScope ? { ...p, crop } : p;
  });
}

/**
 * Split the page list into contiguous groups. `boundaries` is a set of indices
 * where a new group *begins* (e.g. {3} splits [0,1,2 | 3,4,...]). Index 0 is
 * implicitly a boundary. Returns one group per output file.
 */
export function splitAt(
  pages: PageDescriptor[],
  boundaries: ReadonlySet<number>,
): PageDescriptor[][] {
  if (pages.length === 0) return [];
  const groups: PageDescriptor[][] = [];
  let current: PageDescriptor[] = [];
  pages.forEach((page, i) => {
    if (i !== 0 && boundaries.has(i)) {
      groups.push(current);
      current = [];
    }
    current.push(page);
  });
  if (current.length) groups.push(current);
  return groups;
}

/**
 * Round-robin interleave several page groups: one page from each group in turn
 * until all are exhausted. Unequal lengths are handled gracefully (a depleted
 * group is simply skipped). This is the core of "Mix".
 *
 * For a double-sided scan done on a single-sided feeder: group A = fronts
 * (straight), group B = backs scanned last-to-first (reverse B before calling),
 * and interleaving yields the correct front,back,front,back… order.
 */
export function interleave(groups: PageDescriptor[][]): PageDescriptor[] {
  const result: PageDescriptor[] = [];
  const max = groups.reduce((m, g) => Math.max(m, g.length), 0);
  for (let i = 0; i < max; i += 1) {
    for (const g of groups) {
      if (i < g.length) result.push(g[i]);
    }
  }
  return result;
}

/**
 * Given split marks meaning "a split occurs *after* this page id", produce the
 * set of begin-indices that `splitAt` expects.
 */
export function boundariesFromMarks(
  pages: PageDescriptor[],
  marks: ReadonlySet<string>,
): Set<number> {
  const boundaries = new Set<number>();
  pages.forEach((p, i) => {
    if (marks.has(p.id) && i + 1 < pages.length) boundaries.add(i + 1);
  });
  return boundaries;
}

/**
 * Split marks for "split every N pages": a mark after every Nth page, except a
 * trailing mark on the very last page (which would make an empty final part).
 */
export function everyNMarks(
  pages: PageDescriptor[],
  n: number,
): Set<string> {
  const marks = new Set<string>();
  if (n < 1) return marks;
  pages.forEach((p, i) => {
    if ((i + 1) % n === 0 && i < pages.length - 1) marks.add(p.id);
  });
  return marks;
}

/**
 * Map each page id to its 1-based "Part" number, where a split mark ends the
 * current part *after* that page.
 */
export function partNumbers(
  pages: PageDescriptor[],
  marks: ReadonlySet<string>,
): Map<string, number> {
  const result = new Map<string, number>();
  let part = 1;
  for (const p of pages) {
    result.set(p.id, part);
    if (marks.has(p.id)) part += 1;
  }
  return result;
}
