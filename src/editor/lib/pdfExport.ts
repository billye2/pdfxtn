import { PDFDocument, degrees } from 'pdf-lib';
import type { LoadedDoc } from './pdfRender';
import type { PageDescriptor } from './pageModel';

/**
 * Build a single PDF (as bytes) from an ordered list of descriptors. Source
 * pdf-lib documents are loaded once and cached for the duration of the call.
 */
export async function buildDocument(
  pages: PageDescriptor[],
  docsById: Map<string, LoadedDoc>,
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const sourceCache = new Map<string, PDFDocument>();

  async function getSource(docId: string): Promise<PDFDocument> {
    const cached = sourceCache.get(docId);
    if (cached) return cached;
    const loaded = docsById.get(docId);
    if (!loaded) throw new Error(`Unknown source document: ${docId}`);
    // Copy bytes — PDFDocument.load may detach the underlying buffer.
    const src = await PDFDocument.load(loaded.bytes.slice());
    sourceCache.set(docId, src);
    return src;
  }

  for (const desc of pages) {
    const src = await getSource(desc.docId);
    const [copied] = await out.copyPages(src, [desc.pageIndex]);

    if (desc.rotation) {
      // Compose with any intrinsic rotation already on the page.
      const existing = copied.getRotation().angle;
      copied.setRotation(degrees((existing + desc.rotation) % 360));
    }

    if (desc.crop) {
      // Normalized crop is top-left origin over the unrotated page; PDF boxes
      // use bottom-left origin in points.
      const { width: w, height: h } = copied.getSize();
      const cx = desc.crop.x * w;
      const cw = desc.crop.w * w;
      const ch = desc.crop.h * h;
      const cy = h * (1 - desc.crop.y - desc.crop.h);
      copied.setCropBox(cx, cy, cw, ch);
    }

    out.addPage(copied);
  }

  return out.save();
}

function triggerDownload(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after a tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function baseName(name: string): string {
  return name.replace(/\.pdf$/i, '');
}

/** Export the full page list as one file: `<name>-edited.pdf`. */
export async function exportSingle(
  pages: PageDescriptor[],
  docsById: Map<string, LoadedDoc>,
  name: string,
): Promise<void> {
  const bytes = await buildDocument(pages, docsById);
  triggerDownload(bytes, `${baseName(name)}-edited.pdf`);
}

/** Export several groups (split) as separate sequential downloads. */
export async function exportGroups(
  groups: PageDescriptor[][],
  docsById: Map<string, LoadedDoc>,
  name: string,
): Promise<void> {
  const base = baseName(name);
  for (let i = 0; i < groups.length; i += 1) {
    const bytes = await buildDocument(groups[i], docsById);
    triggerDownload(bytes, `${base}-part${i + 1}.pdf`);
  }
}
