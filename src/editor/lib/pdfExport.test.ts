import { describe, it, expect } from 'vitest';
import { PDFDocument, degrees } from 'pdf-lib';
import { buildDocument } from './pdfExport';
import type { LoadedDoc } from './pdfRender';
import { nextPageId, type PageDescriptor, type Rotation } from './pageModel';

/**
 * Build a source PDF whose pages have the given [width, height] sizes, so tests
 * can identify pages in the output by their dimensions.
 */
async function makeSourceBytes(
  sizes: Array<[number, number]>,
  intrinsicRotation = 0,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const [w, h] of sizes) {
    const page = doc.addPage([w, h]);
    if (intrinsicRotation) page.setRotation(degrees(intrinsicRotation));
  }
  return doc.save();
}

/** Minimal LoadedDoc — buildDocument only reads `.bytes`. */
function fakeDoc(id: string, bytes: Uint8Array): LoadedDoc {
  return { id, name: `${id}.pdf`, bytes } as unknown as LoadedDoc;
}

function desc(
  docId: string,
  pageIndex: number,
  extra: Partial<PageDescriptor> = {},
): PageDescriptor {
  return { id: nextPageId(), docId, pageIndex, rotation: 0 as Rotation, ...extra };
}

async function loadOutput(bytes: Uint8Array) {
  return PDFDocument.load(bytes);
}

describe('buildDocument', () => {
  it('reflects descriptor count and order in the output', async () => {
    const bytes = await makeSourceBytes([
      [100, 100],
      [200, 200],
      [300, 300],
    ]);
    const docs = new Map([['d1', fakeDoc('d1', bytes)]]);

    // Reorder: page2 (200w), page0 (100w), page2-index... use [2,0,1]
    const pages = [desc('d1', 2), desc('d1', 0), desc('d1', 1)];
    const out = await loadOutput(await buildDocument(pages, docs));

    expect(out.getPageCount()).toBe(3);
    expect(out.getPages().map((p) => Math.round(p.getWidth()))).toEqual([300, 100, 200]);
  });

  it('drops deleted pages (export reflects a filtered list)', async () => {
    const bytes = await makeSourceBytes([
      [100, 100],
      [200, 200],
      [300, 300],
    ]);
    const docs = new Map([['d1', fakeDoc('d1', bytes)]]);

    // Simulate "delete the middle page" by simply not including it.
    const pages = [desc('d1', 0), desc('d1', 2)];
    const out = await loadOutput(await buildDocument(pages, docs));

    expect(out.getPageCount()).toBe(2);
    expect(out.getPages().map((p) => Math.round(p.getWidth()))).toEqual([100, 300]);
  });

  it('applies descriptor rotation', async () => {
    const bytes = await makeSourceBytes([[100, 200]]);
    const docs = new Map([['d1', fakeDoc('d1', bytes)]]);

    const out = await loadOutput(
      await buildDocument([desc('d1', 0, { rotation: 90 })], docs),
    );
    expect(out.getPage(0).getRotation().angle).toBe(90);
  });

  it('composes descriptor rotation with the page\'s intrinsic rotation', async () => {
    const bytes = await makeSourceBytes([[100, 200]], 90);
    const docs = new Map([['d1', fakeDoc('d1', bytes)]]);

    const out = await loadOutput(
      await buildDocument([desc('d1', 0, { rotation: 90 })], docs),
    );
    expect(out.getPage(0).getRotation().angle).toBe(180);
  });

  it('sets the crop box from a normalized top-left rectangle', async () => {
    const W = 400;
    const H = 600;
    const bytes = await makeSourceBytes([[W, H]]);
    const docs = new Map([['d1', fakeDoc('d1', bytes)]]);

    const crop = { x: 0.1, y: 0.2, w: 0.5, h: 0.3 };
    const out = await loadOutput(
      await buildDocument([desc('d1', 0, { crop })], docs),
    );

    const box = out.getPage(0).getCropBox();
    expect(box.x).toBeCloseTo(crop.x * W, 4); // 40
    expect(box.width).toBeCloseTo(crop.w * W, 4); // 200
    expect(box.height).toBeCloseTo(crop.h * H, 4); // 180
    // top-left origin → bottom-left: H * (1 - y - h) = 600 * 0.5 = 300
    expect(box.y).toBeCloseTo(H * (1 - crop.y - crop.h), 4);
  });

  it('merges pages from multiple source documents', async () => {
    const a = await makeSourceBytes([[100, 100]]);
    const b = await makeSourceBytes([[222, 222]]);
    const docs = new Map([
      ['dA', fakeDoc('dA', a)],
      ['dB', fakeDoc('dB', b)],
    ]);

    // Interleave: B, A
    const out = await loadOutput(
      await buildDocument([desc('dB', 0), desc('dA', 0)], docs),
    );
    expect(out.getPageCount()).toBe(2);
    expect(out.getPages().map((p) => Math.round(p.getWidth()))).toEqual([222, 100]);
  });

  it('throws for an unknown source document', async () => {
    await expect(buildDocument([desc('missing', 0)], new Map())).rejects.toThrow(
      /Unknown source document/,
    );
  });
});
