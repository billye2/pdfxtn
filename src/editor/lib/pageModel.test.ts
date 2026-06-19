import { describe, it, expect } from 'vitest';
import {
  applyCrop,
  boundariesFromMarks,
  deleteSelected,
  partNumbers,
  reorder,
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
    expect(result.every((p) => p.crop === crop)).toBe(true);
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
