// Central pdf.js setup. The worker is bundled by Vite via the `?url` import so it
// loads from the extension origin (MV3 CSP forbids the default CDN worker).
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export { pdfjsLib };
export type PdfDocument = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;
