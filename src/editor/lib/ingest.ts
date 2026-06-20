import { PDFDocument } from 'pdf-lib';
import { loadDoc, type LoadedDoc } from './pdfRender';
import { nextPageId, type PageDescriptor } from './pageModel';

export function isImageFile(file: File): boolean {
  return (
    file.type === 'image/png' ||
    file.type === 'image/jpeg' ||
    /\.(png|jpe?g)$/i.test(file.name)
  );
}

let docCounter = 0;
function nextDocId(): string {
  docCounter += 1;
  return `d${docCounter}`;
}

export interface IngestResult {
  doc: LoadedDoc;
  pages: PageDescriptor[];
}

async function ingestBytes(name: string, bytes: Uint8Array): Promise<IngestResult> {
  const docId = nextDocId();
  const doc = await loadDoc(docId, name, bytes);
  const pages: PageDescriptor[] = Array.from({ length: doc.pageCount }, (_, i) => ({
    id: nextPageId(),
    docId,
    pageIndex: i,
    rotation: 0,
  }));
  return { doc, pages };
}

/** Load a PDF chosen via file picker or drag-and-drop. */
export async function ingestFile(file: File): Promise<IngestResult> {
  const buf = await file.arrayBuffer();
  return ingestBytes(file.name, new Uint8Array(buf));
}

/**
 * Turn image files (JPG/PNG) into a single PDF — one page per image, sized to
 * the image — then ingest it like any other PDF so it becomes normal pages.
 */
export async function ingestImages(files: File[]): Promise<IngestResult> {
  const pdf = await PDFDocument.create();
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);
    const img = isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const page = pdf.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  const out = await pdf.save();
  const name =
    files.length === 1
      ? files[0].name.replace(/\.(png|jpe?g)$/i, '') + '.pdf'
      : `Images (${files.length}).pdf`;
  return ingestBytes(name, out);
}

/** Load a PDF from a URL (the PDF open in the active tab). */
export async function ingestUrl(url: string): Promise<IngestResult> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch PDF (${res.status})`);
  const buf = await res.arrayBuffer();
  const name = decodeURIComponent(url.split('/').pop() || 'document.pdf');
  return ingestBytes(name, new Uint8Array(buf));
}

/** Pull the one-shot source URL stashed by the background worker, if any. */
export async function consumePendingSource(): Promise<string | null> {
  const key = 'pendingPdfSource';
  const stored = await chrome.storage.session.get(key);
  const url = (stored?.[key] as string | null) ?? null;
  if (url) await chrome.storage.session.remove(key);
  return url;
}
