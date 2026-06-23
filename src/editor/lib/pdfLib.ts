// pdf-lib is only needed for export and image→PDF ingest, not for the initial
// editor render (that path uses pdf.js). Load it on first use via a cached
// dynamic import so it lands in its own chunk and doesn't bloat first paint.
let pdfLibPromise: Promise<typeof import('pdf-lib')> | null = null;

export function loadPdfLib(): Promise<typeof import('pdf-lib')> {
  return (pdfLibPromise ??= import('pdf-lib'));
}
