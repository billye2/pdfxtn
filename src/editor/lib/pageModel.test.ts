import { describe, it, expect } from 'vitest';
import {
  applyCrop,
  clampCrop,
  boundariesFromMarks,
  deinterleave,
  deleteSelected,
  duplicateSelected,
  everyNMarks,
  interleave,
  partNumbers,
  reorder,
  reversePages,
  rotateOne,
  rotateSelected,
  splitAt,
  type CropRect,
  type PageDescriptor,
  type Rotation,
} from './pageModel';

// Build a simple page list "p0".."pN-1" all from the same source doc.
function makePages(n: number, docId = 'd1'): PageDescriptor[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    docId,
    pageIndex: i,
    rotation: 0 as Rotation,
  }));
}
const ids = (pages: PageDescriptor[]) => pages.map((p) => p.id);

describe('rotateOne', () => {
  it('wraps within 0..270', () => {
    expect(rotateOne(0, 90)).toBe(90);
    expect(rotateOne(270, 90)).toBe(0);
    expect(rotateOne(0, -90)).toBe(270);
    expect(rotateOne(180, 180)).toBe(0);
    expect(rotateOne(90, 180)).toBe(270);
  });
});

describe('reorder', () => {
  it('moves an item forward', () => {
    expect(ids(reorder(makePages(4), 0, 2))).toEqual(['p1', 'p2', 'p0', 'p3']);
  });
  it('moves an item backward', () => {
    expect(ids(reorder(makePages(4), 3, 1))).toEqual(['p0', 'p3', 'p1', 'p2']);
  });
  it('is a no-op when from === to', () => {
    const pages = makePages(3);
    expect(reorder(pages, 1, 1)).toBe(pages);
  });
  it('does not mutate the input', () => {
    const pages = makePages(3);
    reorder(pages, 0, 2);
    expect(ids(pages)).toEqual(['p0', 'p1', 'p2']);
  });
});

describe('deleteSelected', () => {
  it('removes only selected ids', () => {
    const result = deleteSelected(makePages(4), new Set(['p1', 'p3']));
    expect(ids(result)).toEqual(['p0', 'p2']);
  });
  it('returns all pages when selection is empty', () => {
    expect(ids(deleteSelected(makePages(2), new Set()))).toEqual(['p0', 'p1']);
  });
});

describe('rotateSelected', () => {
  it('rotates only selected pages, leaving others untouched', () => {
    const result = rotateSelected(makePages(3), new Set(['p1']), 90);
    expect(result.map((p) => p.rotation)).toEqual([0, 90, 0]);
  });
  it('accumulates rotation across calls', () => {
    let pages = makePages(1);
    pages = rotateSelected(pages, new Set(['p0']), 90);
    pages = rotateSelected(pages, new Set(['p0']), 90);
    expect(pages[0].rotation).toBe(180);
  });
});

describe('applyCrop', () => {
  const crop: CropRect = { x: 0.1, y: 0.1, w: 0.5, h: 0.5 };

  it('applies to all pages when scope is "all"', () => {
    const result = applyCrop(makePages(3), crop, 'all', new Set(['p0']));
    expect(result.every((p) => p.crop)).toBe(true);
    expect(result.map((p) => p.crop)).toEqual([crop, crop, crop]);
  });
  it('applies only to selected when scope is "selected"', () => {
    const result = applyCrop(makePages(3), crop, 'selected', new Set(['p1']));
    expect(result.map((p) => p.crop)).toEqual([undefined, crop, undefined]);
  });
  it('clears the crop when passed undefined', () => {
    const cropped = applyCrop(makePages(2), crop, 'all', new Set());
    const cleared = applyCrop(cropped, undefined, 'all', new Set());
    expect(cleared.every((p) => p.crop === undefined)).toBe(true);
  });
  it('clamps an out-of-bounds crop into the unit square', () => {
    const c = applyCrop(
      makePages(1),
      { x: 0.8, y: 0.9, w: 0.5, h: 0.5 },
      'all',
      new Set(),
    )[0].crop!;
    expect(c.x).toBe(0.8);
    expect(c.y).toBe(0.9);
    expect(c.x + c.w).toBeCloseTo(1);
    expect(c.y + c.h).toBeCloseTo(1);
  });
});

describe('clampCrop', () => {
  it('leaves an in-bounds rectangle unchanged', () => {
    const c = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
    expect(clampCrop(c)).toEqual(c);
  });
  it('clamps negative origins to zero', () => {
    expect(clampCrop({ x: -0.2, y: -0.5, w: 0.5, h: 0.5 })).toEqual({
      x: 0,
      y: 0,
      w: 0.5,
      h: 0.5,
    });
  });
  it('shrinks width/height so the box never overflows', () => {
    const c = clampCrop({ x: 0.7, y: 0.6, w: 0.9, h: 0.9 });
    expect(c.x).toBe(0.7);
    expect(c.y).toBe(0.6);
    expect(c.x + c.w).toBeCloseTo(1);
    expect(c.y + c.h).toBeCloseTo(1);
  });
});

describe('splitAt', () => {
  it('returns one group when there are no boundaries', () => {
    const groups = splitAt(makePages(3), new Set());
    expect(groups.map(ids)).toEqual([['p0', 'p1', 'p2']]);
  });
  it('splits at the given boundary indices', () => {
    const groups = splitAt(makePages(5), new Set([2, 4]));
    expect(groups.map(ids)).toEqual([['p0', 'p1'], ['p2', 'p3'], ['p4']]);
  });
  it('treats index 0 as implicit (a 0 boundary does not create an empty group)', () => {
    const groups = splitAt(makePages(3), new Set([0, 2]));
    expect(groups.map(ids)).toEqual([['p0', 'p1'], ['p2']]);
  });
  it('returns [] for an empty page list', () => {
    expect(splitAt([], new Set([1]))).toEqual([]);
  });
});

describe('boundariesFromMarks', () => {
  it('places a boundary after each marked page', () => {
    const pages = makePages(5);
    // split after p1 and p3 → groups begin at index 2 and 4
    const marks = new Set(['p1', 'p3']);
    expect([...boundariesFromMarks(pages, marks)].sort()).toEqual([2, 4]);
  });
  it('ignores a mark on the final page (no trailing empty group)', () => {
    const pages = makePages(3);
    expect([...boundariesFromMarks(pages, new Set(['p2']))]).toEqual([]);
  });
  it('round-trips with splitAt to produce the expected groups', () => {
    const pages = makePages(5);
    const marks = new Set(['p1', 'p3']);
    const groups = splitAt(pages, boundariesFromMarks(pages, marks));
    expect(groups.map(ids)).toEqual([['p0', 'p1'], ['p2', 'p3'], ['p4']]);
  });
});

describe('interleave', () => {
  it('alternates pages from two equal groups', () => {
    const a = makePages(3, 'A');
    const b = makePages(3, 'B');
    const out = interleave([a, b]);
    expect(out.map((p) => `${p.docId}${p.pageIndex}`)).toEqual([
      'A0',
      'B0',
      'A1',
      'B1',
      'A2',
      'B2',
    ]);
  });

  it('fixes a double-sided scan (fronts straight, backs reversed)', () => {
    // fronts = pages 1,2,3 ; backs scanned last-to-first = 6,5,4
    const fronts = makePages(3, 'F'); // F0,F1,F2  → pages 1,2,3
    const backsScanned = makePages(3, 'B'); // B0,B1,B2 = scanned order of 6,5,4
    const backs = backsScanned.slice().reverse(); // reverse → B2,B1,B0 = 4,5,6
    const out = interleave([fronts, backs]);
    // expected document order: 1,4,2,5,3,6
    expect(out.map((p) => `${p.docId}${p.pageIndex}`)).toEqual([
      'F0',
      'B2',
      'F1',
      'B1',
      'F2',
      'B0',
    ]);
  });

  it('handles unequal lengths by skipping the depleted group', () => {
    const a = makePages(3, 'A');
    const b = makePages(1, 'B');
    const out = interleave([a, b]);
    expect(out.map((p) => `${p.docId}${p.pageIndex}`)).toEqual(['A0', 'B0', 'A1', 'A2']);
  });

  it('returns [] for no groups', () => {
    expect(interleave([])).toEqual([]);
  });
});

describe('everyNMarks', () => {
  it('marks after every Nth page, except the last page', () => {
    const pages = makePages(7);
    // split every 2 → marks after pages at index 1,3,5 (pages 2,4,6)
    const marks = everyNMarks(pages, 2);
    expect(pages.filter((p) => marks.has(p.id)).map((p) => p.id)).toEqual([
      'p1',
      'p3',
      'p5',
    ]);
  });
  it('produces ceil(total/n) parts when round-tripped through splitAt', () => {
    const pages = makePages(7);
    const groups = splitAt(pages, boundariesFromMarks(pages, everyNMarks(pages, 3)));
    expect(groups.map((g) => g.length)).toEqual([3, 3, 1]); // ceil(7/3) = 3 parts
  });
  it('never marks the final page (no empty trailing part)', () => {
    const pages = makePages(4);
    const marks = everyNMarks(pages, 4); // would mark index 3 (last) — must not
    expect(marks.size).toBe(0);
  });
  it('returns empty for n < 1', () => {
    expect(everyNMarks(makePages(3), 0).size).toBe(0);
  });
});

describe('partNumbers', () => {
  it('assigns increasing part numbers after each split mark', () => {
    const pages = makePages(5);
    const marks = new Set(['p1', 'p3']);
    const parts = partNumbers(pages, marks);
    expect(pages.map((p) => parts.get(p.id))).toEqual([1, 1, 2, 2, 3]);
  });
  it('is all part 1 with no marks', () => {
    const pages = makePages(3);
    const parts = partNumbers(pages, new Set());
    expect(pages.map((p) => parts.get(p.id))).toEqual([1, 1, 1]);
  });
});

describe('duplicateSelected', () => {
  // Deterministic ids for assertions.
  const makeIds = () => {
    let n = 0;
    return () => `c${n++}`;
  };

  it('inserts a copy immediately after each selected page', () => {
    const { pages, newIds } = duplicateSelected(
      makePages(3),
      new Set(['p0', 'p2']),
      makeIds(),
    );
    expect(ids(pages)).toEqual(['p0', 'c0', 'p1', 'p2', 'c1']);
    expect(newIds).toEqual(['c0', 'c1']);
  });

  it('handles adjacent selected pages', () => {
    const { pages } = duplicateSelected(makePages(3), new Set(['p0', 'p1']), makeIds());
    expect(ids(pages)).toEqual(['p0', 'c0', 'p1', 'c1', 'p2']);
  });

  it('copies carry rotation and crop but keep the same source page', () => {
    const crop: CropRect = { x: 0.1, y: 0.1, w: 0.5, h: 0.5 };
    const source: PageDescriptor[] = [
      { id: 'p0', docId: 'd1', pageIndex: 4, rotation: 90, crop },
    ];
    const { pages } = duplicateSelected(source, new Set(['p0']), makeIds());
    expect(pages[1]).toEqual({
      id: 'c0',
      docId: 'd1',
      pageIndex: 4,
      rotation: 90,
      crop,
    });
  });

  it('returns the same array instance for an empty selection', () => {
    const pages = makePages(3);
    expect(duplicateSelected(pages, new Set()).pages).toBe(pages);
  });

  it('does not mutate the input', () => {
    const pages = makePages(2);
    duplicateSelected(pages, new Set(['p0']), makeIds());
    expect(ids(pages)).toEqual(['p0', 'p1']);
  });

  it('generates unique real ids by default', () => {
    const { pages, newIds } = duplicateSelected(makePages(2), new Set(['p0', 'p1']));
    expect(new Set(ids(pages)).size).toBe(4);
    expect(newIds.every((id) => id.startsWith('p_'))).toBe(true);
  });
});

describe('reversePages', () => {
  it('reverses the whole list when nothing is selected', () => {
    expect(ids(reversePages(makePages(4), new Set()))).toEqual(['p3', 'p2', 'p1', 'p0']);
  });

  it('reverses the whole list when only one page is selected', () => {
    expect(ids(reversePages(makePages(3), new Set(['p1'])))).toEqual(['p2', 'p1', 'p0']);
  });

  it('reverses only the selected pages, within their slots', () => {
    // Select p0, p2, p3 of 5 — p1 and p4 must not move.
    const result = reversePages(makePages(5), new Set(['p0', 'p2', 'p3']));
    expect(ids(result)).toEqual(['p3', 'p1', 'p2', 'p0', 'p4']);
  });

  it('ignores selected ids that are not in the list', () => {
    const result = reversePages(makePages(3), new Set(['ghost', 'p0', 'p2']));
    expect(ids(result)).toEqual(['p2', 'p1', 'p0']);
  });

  it('returns the same array instance for lists of ≤1 page', () => {
    const one = makePages(1);
    expect(reversePages(one, new Set())).toBe(one);
    const none = makePages(0);
    expect(reversePages(none, new Set())).toBe(none);
  });

  it('does not mutate the input', () => {
    const pages = makePages(3);
    reversePages(pages, new Set());
    reversePages(pages, new Set(['p0', 'p2']));
    expect(ids(pages)).toEqual(['p0', 'p1', 'p2']);
  });
});

describe('deinterleave', () => {
  it('splits even counts into equal halves', () => {
    const [fronts, backs] = deinterleave(makePages(4));
    expect(ids(fronts)).toEqual(['p0', 'p2']);
    expect(ids(backs)).toEqual(['p1', 'p3']);
  });

  it('gives the first half the extra page for odd counts', () => {
    const [fronts, backs] = deinterleave(makePages(5));
    expect(ids(fronts)).toEqual(['p0', 'p2', 'p4']);
    expect(ids(backs)).toEqual(['p1', 'p3']);
  });

  it('handles empty and single-page lists', () => {
    expect(deinterleave([])).toEqual([[], []]);
    const [fronts, backs] = deinterleave(makePages(1));
    expect(ids(fronts)).toEqual(['p0']);
    expect(backs).toEqual([]);
  });

  it('is the inverse of interleave', () => {
    const pages = makePages(7);
    expect(ids(interleave([...deinterleave(pages)]))).toEqual(ids(pages));
  });
});
