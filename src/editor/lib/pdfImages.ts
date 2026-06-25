import { zipSync } from 'fflate';
import { renderPageBitmap, type LoadedDoc } from './pdfRender';
import type { PageDescriptor } from './pageModel';

export type ImageFormat = 'png' | 'jpeg';

export interface ImageExportOptions {
  format: ImageFormat;
  /** Multiplies the page's native pixel size (1 = ~72dpi, 2 = ~144dpi, …). */
  scale: number;
  /** Bundle the pages into one `.zip` instead of downloading each separately. */
  zip?: boolean;
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
 * Render each page to an image, reflecting current rotation and crop. Files are
 * named `<name>-pNN.<ext>`. By default each downloads separately; with
 * `opts.zip` they're bundled into a single `<name>-images.zip` — much friendlier
 * than N browser downloads when exporting a large document.
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

  const files: { name: string; blob: Blob }[] = [];
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
    files.push({ name: `${base}-p${String(i + 1).padStart(pad, '0')}.${ext}`, blob });
  }

  if (opts.zip && files.length > 0) {
    // JPEG/PNG are already compressed, so store (level 0) — faster, same size.
    const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
    for (const f of files) {
      entries[f.name] = [new Uint8Array(await f.blob.arrayBuffer()), { level: 0 }];
    }
    download(
      new Blob([zipSync(entries)], { type: 'application/zip' }),
      `${base}-images.zip`,
    );
  } else {
    for (const f of files) download(f.blob, f.name);
  }
  return files.length;
}
