// Shared Playwright helpers for the functional, a11y, and visual suites.
// Extracted from extension.spec.ts so every spec drives the extension the
// same way. Each spec file owns its own persistent context via
// launchExtension() in beforeAll (workers: 1, so contexts never overlap).
import {
  expect,
  chromium,
  type BrowserContext,
  type Page,
  type Download,
} from '@playwright/test';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const distPath = join(here, '..', 'dist');
export const iconPng = readFileSync(join(here, '..', 'src', 'icons', 'icon128.png'));

/** Launch full Chromium with the built extension loaded and resolve its id.
 * `--headless=new` because the headless shell can't load extensions. */
export async function launchExtension(): Promise<{
  context: BrowserContext;
  extensionId: string;
}> {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--headless=new',
      '--no-sandbox',
      `--disable-extensions-except=${distPath}`,
      `--load-extension=${distPath}`,
    ],
  });
  await context.newPage();
  let sw = context.serviceWorkers()[0];
  for (let i = 0; i < 40 && !sw; i += 1) {
    await new Promise((r) => setTimeout(r, 250));
    sw = context.serviceWorkers()[0];
  }
  if (!sw) throw new Error('extension service worker did not start');
  return { context, extensionId: sw.url().split('/')[2] };
}

export async function openEditor(
  context: BrowserContext,
  extensionId: string,
): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/editor/index.html`);
  await expect(page.getByText("Let's fix up your PDF!")).toBeVisible();
  return page;
}

export async function makePdf(
  sizes: Array<[number, number]>,
  rotate = 0,
): Promise<number[]> {
  const doc = await PDFDocument.create();
  for (const [w, h] of sizes) {
    const p = doc.addPage([w, h]);
    if (rotate) p.setRotation(degrees(rotate));
  }
  return [...(await doc.save())];
}

export async function imagePdf(n: number): Promise<number[]> {
  const doc = await PDFDocument.create();
  const img = await doc.embedPng(iconPng);
  for (let i = 0; i < n; i += 1) {
    const p = doc.addPage([300, 300]);
    p.drawImage(img, { x: 20, y: 20, width: 200, height: 200 });
  }
  return [...(await doc.save())];
}

// A few document-like pages so thumbnails look real (title + faux text lines).
// Keep in sync with scripts/screenshots.mjs samplePdf().
export async function samplePdf(): Promise<number[]> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const titles = [
    'Quarterly Report',
    'Invoice #1042',
    'Project Brief',
    'Meeting Notes',
    'Appendix A',
    'Contract',
  ];
  for (let i = 0; i < titles.length; i += 1) {
    const p = doc.addPage([612, 792]);
    p.drawText(titles[i], {
      x: 56,
      y: 712,
      size: 26,
      font: bold,
      color: rgb(0.13, 0.12, 0.25),
    });
    for (let l = 0; l < 22; l += 1) {
      const w = 360 + ((i * 7 + l * 13) % 130);
      p.drawRectangle({
        x: 56,
        y: 672 - l * 26,
        width: w,
        height: 9,
        color: rgb(0.86, 0.87, 0.91),
      });
    }
  }
  return [...(await doc.save())];
}

export async function drop(
  page: Page,
  files: Array<{ name: string; bytes: number[]; type: string }>,
) {
  const dt = await page.evaluateHandle((fs) => {
    const d = new DataTransfer();
    for (const f of fs)
      d.items.add(new File([new Uint8Array(f.bytes)], f.name, { type: f.type }));
    return d;
  }, files);
  await page.dispatchEvent('.app', 'dragover', { dataTransfer: dt });
  await page.dispatchEvent('.app', 'drop', { dataTransfer: dt });
}

export const pdf = (name: string, bytes: number[]) => ({
  name,
  bytes,
  type: 'application/pdf',
});

export async function widths(d: Download): Promise<number[]> {
  const out = await PDFDocument.load(readFileSync(await d.path()));
  return out.getPages().map((p) => Math.round(p.getWidth()));
}

// Crop is applied as the PDF CropBox (not the MediaBox), so getWidth() — which
// reads the MediaBox — won't reflect it. Read the CropBox of page 0 directly.
export async function cropBox(d: Download): Promise<{ w: number; h: number }> {
  const out = await PDFDocument.load(readFileSync(await d.path()));
  const b = out.getPage(0).getCropBox();
  return { w: Math.round(b.width), h: Math.round(b.height) };
}

// Generate a real JPEG in the page so embedJpg has valid bytes to ingest.
export async function makeJpeg(page: Page): Promise<number[]> {
  return page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 48;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#c33';
    ctx.fillRect(0, 0, c.width, c.height);
    const blob: Blob = await new Promise((res) =>
      c.toBlob((b) => res(b!), 'image/jpeg', 0.9),
    );
    return [...new Uint8Array(await blob.arrayBuffer())];
  });
}
