import { renderPageBitmap, type LoadedDoc } from './pdfRender';
import type { PageDescriptor } from './pageModel';

export type ImageFormat = 'png' | 'jpeg';

export interface ImageExportOptions {
  format: ImageFormat;
  /** Multiplies the page's native pixel size (1 = ~72dpi, 2 = ~144dpi, …). */
  scale: number;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))),
      type,
      quality,
    );
  });
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** JPEG has no alpha — flatten onto white so transparent areas aren't black. */
function flattenForJpeg(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

/**
 * Render each page to an image and download it. One file per page,
 * `<name>-pNN.<ext>`, reflecting current rotation and crop.
 */
export async function exportPagesAsImages(
  pages: PageDescriptor[],
  docsById: Map<string, LoadedDoc>,
  name: string,
  opts: ImageExportOptions,
): Promise<number> {
  const base = name.replace(/\.pdf$/i, '');
  const ext = opts.format === 'jpeg' ? 'jpg' : 'png';
  const type = opts.format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const pad = String(pages.length).length;

  let saved = 0;
  for (let i = 0; i < pages.length; i += 1) {
    const desc = pages[i];
    const doc = docsById.get(desc.docId);
    if (!doc) continue;

    let canvas = await renderPageBitmap(doc, desc.pageIndex, {
      scale: opts.scale,
      rotation: desc.rotation,
      crop: desc.crop,
    });
    if (opts.format === 'jpeg') canvas = flattenForJpeg(canvas);

    const blob = await canvasToBlob(
      canvas,
      type,
      opts.format === 'jpeg' ? 0.92 : undefined,
    );
    download(blob, `${base}-p${String(i + 1).padStart(pad, '0')}.${ext}`);
    saved += 1;
  }
  return saved;
}
