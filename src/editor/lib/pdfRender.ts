import { pdfjsLib, type PdfDocument } from './pdfjs';
import type { Rotation } from './pageModel';

/**
 * Holds a parsed pdf.js document plus its raw bytes. We keep the bytes around so
 * pdf-lib can rebuild the output without re-fetching. pdf.js detaches the
 * ArrayBuffer it's given, so callers must pass a copy if they need the original.
 */
export interface LoadedDoc {
  id: string;
  name: string;
  bytes: Uint8Array;
  pdf: PdfDocument;
  pageCount: number;
}

export async function loadDoc(
  id: string,
  name: string,
  bytes: Uint8Array,
): Promise<LoadedDoc> {
  // pdf.js transfers/detaches the buffer it parses, so hand it a copy and keep
  // our own pristine bytes for export.
  const forParsing = bytes.slice();
  const pdf = await pdfjsLib.getDocument({ data: forParsing }).promise;
  return { id, name, bytes, pdf, pageCount: pdf.numPages };
}

export interface RenderOptions {
  /** Longest-edge target in CSS pixels for the thumbnail. */
  maxEdge?: number;
  /** Extra rotation applied on top of the page's intrinsic rotation. */
  rotation?: Rotation;
}

/**
 * Render a single page into a freshly created canvas at thumbnail size.
 * Returns the canvas so the caller can attach it to the DOM.
 */
export async function renderThumbnail(
  doc: LoadedDoc,
  pageIndex: number,
  { maxEdge = 220, rotation = 0 }: RenderOptions = {},
): Promise<HTMLCanvasElement> {
  const page = await doc.pdf.getPage(pageIndex + 1);
  const base = page.getViewport({ scale: 1, rotation });
  const scale = maxEdge / Math.max(base.width, base.height);
  const viewport = page.getViewport({ scale, rotation });

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

/** Intrinsic (unrotated) page size in PDF points — used for crop math. */
export async function getPagePointSize(
  doc: LoadedDoc,
  pageIndex: number,
): Promise<{ width: number; height: number }> {
  const page = await doc.pdf.getPage(pageIndex + 1);
  const vp = page.getViewport({ scale: 1, rotation: 0 });
  return { width: vp.width, height: vp.height };
}
