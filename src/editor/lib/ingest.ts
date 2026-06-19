import { loadDoc, type LoadedDoc } from './pdfRender';
import { nextPageId, type PageDescriptor } from './pageModel';

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
