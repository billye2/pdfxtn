// Generate Chrome Web Store screenshots (1280x800) of the built extension.
// Run: npm run build && node scripts/screenshots.mjs  → release/screenshots/*.png
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const distPath = join(here, '..', 'dist');
const outDir = join(here, '..', 'release', 'screenshots');
mkdirSync(outDir, { recursive: true });

// A few document-like pages so thumbnails look real (title + faux text lines).
async function samplePdf() {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const titles = ['Quarterly Report', 'Invoice #1042', 'Project Brief', 'Meeting Notes', 'Appendix A', 'Contract'];
  for (let i = 0; i < titles.length; i += 1) {
    const p = doc.addPage([612, 792]);
    p.drawText(titles[i], { x: 56, y: 712, size: 26, font: bold, color: rgb(0.13, 0.12, 0.25) });
    for (let l = 0; l < 22; l += 1) {
      const w = 360 + ((i * 7 + l * 13) % 130);
      p.drawRectangle({ x: 56, y: 672 - l * 26, width: w, height: 9, color: rgb(0.86, 0.87, 0.91) });
    }
  }
  return [...(await doc.save())];
}

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: ['--headless=new', '--no-sandbox', `--disable-extensions-except=${distPath}`, `--load-extension=${distPath}`],
});
await ctx.newPage();
let sw = ctx.serviceWorkers()[0];
for (let i = 0; i < 40 && !sw; i += 1) {
  await new Promise((r) => setTimeout(r, 250));
  sw = ctx.serviceWorkers()[0];
}
const id = sw.url().split('/')[2];

const page = await ctx.newPage();
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(`chrome-extension://${id}/src/editor/index.html`);

const bytes = await samplePdf();
const dt = await page.evaluateHandle((b) => {
  const d = new DataTransfer();
  d.items.add(new File([new Uint8Array(b)], 'sample.pdf', { type: 'application/pdf' }));
  return d;
}, bytes);
await page.dispatchEvent('.app', 'dragover', { dataTransfer: dt });
await page.dispatchEvent('.app', 'drop', { dataTransfer: dt });

await page.waitForSelector('.card .page-canvas');
await page.waitForTimeout(800); // let all visible thumbnails finish rendering

// 1) Editor populated
await page.screenshot({ path: join(outDir, '01-editor.png') });

// 2) Selection + dock
await page.locator('.card').nth(0).click();
await page.locator('.card').nth(2).click({ modifiers: ['ControlOrMeta'] });
await page.locator('.card').nth(4).click({ modifiers: ['ControlOrMeta'] });
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, '02-select-dock.png') });

// 3) Lightbox preview
await page.locator('.card').nth(0).dblclick();
await page.waitForSelector('.lightbox-canvas');
await page.waitForTimeout(500);
await page.screenshot({ path: join(outDir, '03-preview.png') });
await page.keyboard.press('Escape');

// 4) Alternate theme (Bubble)
await page.locator('.look-trigger').click();
await page.locator('.look-option', { hasText: 'Bubble' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: join(outDir, '04-theme.png') });

await ctx.close();
console.log('screenshots written to release/screenshots/');
