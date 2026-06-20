import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const distPath = join(here, '..', 'dist');
const tmpDir = join(here, '.tmp');
const samplePath = join(tmpDir, 'sample.pdf');

let context: BrowserContext;
let extensionId: string;

// Generate a 3-page PDF (distinct page sizes so order is identifiable) and
// launch Chromium (full build, new headless) with the unpacked extension.
test.beforeAll(async () => {
  const doc = await PDFDocument.create();
  for (const [w, h] of [[300, 400], [400, 300], [350, 500]] as const) doc.addPage([w, h]);
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(samplePath, await doc.save());

  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--headless=new',
      '--no-sandbox',
      `--disable-extensions-except=${distPath}`,
      `--load-extension=${distPath}`,
    ],
  });

  // Nudge the MV3 service worker to start, then poll for it (more reliable than
  // a single waitForEvent under new headless).
  await context.newPage();
  let sw = context.serviceWorkers()[0];
  for (let i = 0; i < 40 && !sw; i += 1) {
    await new Promise((r) => setTimeout(r, 250));
    sw = context.serviceWorkers()[0];
  }
  if (!sw) throw new Error('extension service worker did not start');
  extensionId = sw.url().split('/')[2];
});

test.afterAll(async () => {
  await context?.close();
});

test('loads, renders a real PDF, edits, and exports', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/editor/index.html`);

  // Empty state renders.
  await expect(page.getByText("Let's fix up your PDF!")).toBeVisible();

  // Add the sample PDF by simulating a file drop (robust in headless; the
  // empty-state picker uses a detached input the chooser API can't intercept).
  const bytes = [...readFileSync(samplePath)];
  const dataTransfer = await page.evaluateHandle((data) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(data)], 'sample.pdf', { type: 'application/pdf' }));
    return dt;
  }, bytes);
  await page.dispatchEvent('.app', 'dragover', { dataTransfer });
  await page.dispatchEvent('.app', 'drop', { dataTransfer });

  // Three page cards appear, labeled by original page number.
  await expect(page.locator('.card')).toHaveCount(3);
  await expect(page.locator('.card-label').nth(0)).toHaveText('Page 1');
  await expect(page.locator('.card-label').nth(2)).toHaveText('Page 3');

  // pdf.js worker actually rendered a thumbnail (the MV3-CSP-sensitive path).
  await expect(page.locator('.card .page-canvas').first()).toBeVisible({ timeout: 15_000 });

  // Delete page 2; the survivors keep their ORIGINAL labels (1 and 3).
  await page.locator('.card').nth(1).click();
  await page.keyboard.press('Delete');
  await expect(page.locator('.card')).toHaveCount(2);
  await expect(page.locator('.card-label').nth(0)).toHaveText('Page 1');
  await expect(page.locator('.card-label').nth(1)).toHaveText('Page 3');

  // Export and verify the produced PDF (the pdf-lib pipeline) has 2 pages.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  const download = await downloadPromise;
  const out = await PDFDocument.load(readFileSync(await download.path()));
  expect(out.getPageCount()).toBe(2);
});

// Build a PDF that draws one shared image across `n` pages — the case that
// used to bloat the merge ~Nx by re-embedding the image per page.
async function imageHeavyPdf(n: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const img = await doc.embedPng(readFileSync('src/icons/icon128.png'));
  for (let i = 0; i < n; i += 1) {
    const p = doc.addPage([300, 300]);
    p.drawImage(img, { x: 20, y: 20, width: 200, height: 200 });
  }
  return doc.save();
}

test('merging two image-heavy PDFs keeps the exported size sane', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/editor/index.html`);
  await expect(page.getByText("Let's fix up your PDF!")).toBeVisible();

  const a = [...(await imageHeavyPdf(6))];
  const b = [...(await imageHeavyPdf(6))];

  // Drop both PDFs at once → two source docs, 12 pages (the merge).
  const dataTransfer = await page.evaluateHandle(({ x, y }) => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(x)], 'a.pdf', { type: 'application/pdf' }));
    dt.items.add(new File([new Uint8Array(y)], 'b.pdf', { type: 'application/pdf' }));
    return dt;
  }, { x: a, y: b });
  await page.dispatchEvent('.app', 'dragover', { dataTransfer });
  await page.dispatchEvent('.app', 'drop', { dataTransfer });

  await expect(page.locator('.card')).toHaveCount(12);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  const outBytes = readFileSync(await (await downloadPromise).path());
  const out = await PDFDocument.load(outBytes);

  const inputs = a.length + b.length;
  // eslint-disable-next-line no-console
  console.log(
    `merge: inputs ${(inputs / 1024).toFixed(1)}KB → merged ${(outBytes.length / 1024).toFixed(1)}KB ` +
      `(${(outBytes.length / inputs).toFixed(2)}x)`,
  );

  expect(out.getPageCount()).toBe(12);
  // With the fix the merge ≈ sum of inputs; the old per-page copy was many×.
  expect(outBytes.length).toBeLessThan(inputs * 2);
});
