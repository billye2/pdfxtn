// Generate Chrome Web Store screenshots (1280x800) of the built extension.
// Each shot is a branded frame: gradient background + benefit headline, with
// the live UI (captured 1:1 at 1050x640) inset below. Run:
//   npm run build && node scripts/screenshots.mjs  → release/screenshots/*.png
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const distPath = join(here, '..', 'dist');
const outDir = join(here, '..', 'release', 'screenshots');
rmSync(outDir, { recursive: true, force: true }); // start clean so no stale shots linger
mkdirSync(outDir, { recursive: true });

// The store frame is 1280x800; the app is driven and captured at 1050x640 so
// the inset needs no scaling (crisp text) and leaves room for the headline.
const FRAME = { width: 1280, height: 800 };
const RAW = { width: 1050, height: 640 };
const META = process.platform === 'darwin' ? 'Meta' : 'Control';

// ---- Fixtures ----------------------------------------------------------------

// The numbered sample (same document as the repo-root sample-numbers-1-7.pdf,
// generated in-memory like every other fixture): 7 white pages, one huge
// solid-color numeral each, so each shot's operation reads at a glance.
const NUMBER_COLORS = {
  1: [0.0, 0.45, 0.85], // blue
  2: [0.0, 0.62, 0.28], // green
  3: [0.95, 0.55, 0.0], // orange
  4: [0.55, 0.1, 0.75], // purple
  5: [0.0, 0.65, 0.65], // teal
  6: [0.9, 0.15, 0.55], // magenta
  7: [0.45, 0.3, 0.1], // brown
};

async function numbersPdf() {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pw = 612;
  const ph = 792;
  for (let n = 1; n <= 7; n += 1) {
    const page = doc.addPage([pw, ph]);
    const text = String(n);
    const capHeight = (s) => bold.heightAtSize(s, { descender: false });
    let size = 1000;
    while (bold.widthOfTextAtSize(text, size) > pw * 0.8 || capHeight(size) > ph * 0.8) {
      size -= 5;
    }
    const w = bold.widthOfTextAtSize(text, size);
    const h = capHeight(size);
    const [r, g, b] = NUMBER_COLORS[n];
    page.drawText(text, {
      x: (pw - w) / 2,
      y: (ph - h) / 2 + h * 0.06,
      size,
      font: bold,
      color: rgb(r, g, b),
    });
  }
  return [...(await doc.save())];
}

// A blue-tinted page so the merged-in second document reads at a glance.
async function receiptPdf() {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const titles = ['Receipt'];
  for (let i = 0; i < titles.length; i += 1) {
    const p = doc.addPage([612, 792]);
    p.drawRectangle({
      x: 0,
      y: 692,
      width: 612,
      height: 100,
      color: rgb(0.85, 0.91, 0.99),
    });
    p.drawText(titles[i], {
      x: 56,
      y: 726,
      size: 26,
      font: bold,
      color: rgb(0.09, 0.28, 0.6),
    });
    for (let l = 0; l < 22; l += 1) {
      const w = 340 + ((i * 11 + l * 17) % 150);
      p.drawRectangle({
        x: 56,
        y: 648 - l * 26,
        width: w,
        height: 9,
        color: rgb(0.78, 0.86, 0.96),
      });
    }
  }
  return [...(await doc.save())];
}

// ---- Launch ------------------------------------------------------------------

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [
    '--headless=new',
    '--no-sandbox',
    `--disable-extensions-except=${distPath}`,
    `--load-extension=${distPath}`,
  ],
});
await ctx.newPage();
let sw = ctx.serviceWorkers()[0];
for (let i = 0; i < 40 && !sw; i += 1) {
  await new Promise((r) => setTimeout(r, 250));
  sw = ctx.serviceWorkers()[0];
}
const id = sw.url().split('/')[2];

const page = await ctx.newPage();
await page.setViewportSize(RAW);
await page.goto(`chrome-extension://${id}/src/editor/index.html`);

// Toasts ("Added N pages") would photobomb the captures — hide them for good.
await page.addStyleTag({ content: '.toast { display: none !important; }' });

// ---- Helpers -------------------------------------------------------------------

async function dropPdfs(files) {
  const dt = await page.evaluateHandle((fs) => {
    const d = new DataTransfer();
    for (const f of fs)
      d.items.add(
        new File([new Uint8Array(f.bytes)], f.name, { type: 'application/pdf' }),
      );
    return d;
  }, files);
  await page.dispatchEvent('.app', 'dragover', { dataTransfer: dt });
  await page.dispatchEvent('.app', 'drop', { dataTransfer: dt });
}

const waitCards = (n) =>
  page.waitForFunction((c) => document.querySelectorAll('.card').length === c, n);

async function settle() {
  await page.waitForSelector('.card .page-canvas');
  await page.waitForTimeout(800); // let all visible thumbnails finish rendering
}

// Clear the grid between scenes (select-all + Delete keeps the editor alive).
async function resetSession() {
  await page.keyboard.press(`${META}+a`);
  await page.keyboard.press('Delete');
  await waitCards(0);
  await page.waitForTimeout(300);
}

// Capture the app at 1050x640, then re-shoot it inset on a 1280x800 branded
// frame (gradient + headline). Runs inside the extension page so the bundled
// Fredoka/Nunito fonts are available to the caption.
async function shoot(file, headline, sub) {
  const raw = await page.screenshot();
  await page.setViewportSize(FRAME);
  await page.evaluate(
    ([b64, h, s]) => {
      const frame = document.createElement('div');
      frame.id = 'shot-frame';
      frame.style.cssText =
        'position:fixed;inset:0;z-index:2147483647;display:flex;' +
        'flex-direction:column;align-items:center;text-align:center;' +
        'background:linear-gradient(135deg,#ff8369,#e94b43);color:#fff;';
      const head = document.createElement('div');
      head.style.cssText =
        "font:700 44px/1.2 Fredoka, Nunito, 'Helvetica Neue', sans-serif;" +
        'margin-top:24px;letter-spacing:0.3px;';
      head.textContent = h;
      const tag = document.createElement('div');
      tag.style.cssText =
        "font:600 21px/1.3 Nunito, 'Helvetica Neue', sans-serif;" +
        'margin-top:7px;opacity:0.94;';
      tag.textContent = s;
      const img = document.createElement('img');
      img.src = `data:image/png;base64,${b64}`;
      img.width = 1050;
      img.height = 640;
      img.style.cssText =
        'margin-top:18px;border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,0.35);';
      frame.append(head, tag, img);
      document.body.append(frame);
    },
    [raw.toString('base64'), headline, sub],
  );
  await page.waitForFunction(
    () =>
      document.querySelector('#shot-frame img')?.complete &&
      document.fonts.status === 'loaded',
  );
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(outDir, file) });
  await page.evaluate(() => document.getElementById('shot-frame').remove());
  await page.setViewportSize(RAW);
}

// ---- The five shots ------------------------------------------------------------
// All five ride the numbered 1–7 sample so each operation reads at a glance.

// 1) Crop — the dialog open over the big "1" with a drawn box.
await dropPdfs([{ name: 'sample-numbers-1-7.pdf', bytes: await numbersPdf() }]);
await waitCards(7);
await settle();
await page.locator('.card').nth(0).click();
await page.locator('.dock').getByRole('button', { name: 'Crop' }).click();
await page.waitForSelector('.crop-canvas');
await page.waitForTimeout(300);
const stage = await page.locator('.crop-stage').boundingBox();
await page.mouse.move(stage.x + stage.width * 0.16, stage.y + stage.height * 0.14);
await page.mouse.down();
await page.mouse.move(stage.x + stage.width * 0.86, stage.y + stage.height * 0.84, {
  steps: 10,
});
await page.mouse.up();
await page.waitForTimeout(300);
await shoot(
  '01-crop.png',
  'Crop pages visually',
  'Draw one box — keep it to one page, or apply it to all',
);
await page.getByRole('button', { name: 'Cancel' }).click();
await page.waitForSelector('.crop-canvas', { state: 'detached' });
await page.keyboard.press('Escape'); // clear the selection

// 2) Rotate — the "2" spun sideways, still picked, the dock up.
await page.locator('.card').nth(1).click();
await page.locator('.dock').getByRole('button', { name: 'Rotate' }).click();
await page.waitForTimeout(500);
await shoot(
  '02-rotate.png',
  'Rotate pages in one click',
  'One page or a whole pick — 90° at a time, applied on save',
);
await page.keyboard.press(`${META}+z`); // undo the rotation
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// 3) Merge — a second (blue) document dropped in, pages appended.
await dropPdfs([{ name: 'receipt.pdf', bytes: await receiptPdf() }]);
await waitCards(8);
await settle();
await shoot(
  '03-merge.png',
  'Combine PDFs in seconds',
  'Drop files together — pages append, ready to arrange · Nothing is uploaded',
);
// Remove the blue page so the next shots are pure 1–7 again.
await page.locator('.card').nth(7).click();
await page.keyboard.press('Delete');
await waitCards(7);

// 4) Reverse — the whole document flipped to 7…1 with one click.
await page.locator('button[title="Reverse page order"]').click();
await page.waitForTimeout(500);
await shoot(
  '04-reverse.png',
  'Reverse the page order in one click',
  'Scanned back-to-front? Flip the whole document — or just the picked pages',
);

// 5) Dark mode — the same board in the Nighty Night look.
await page.locator('button[title="Reverse page order"]').click(); // back to 1…7
await page.waitForTimeout(400);
await page.locator('.look-trigger').click();
await page.locator('.look-option', { hasText: 'Nighty Night' }).click();
await page.waitForTimeout(600);
await shoot(
  '05-dark-free.png',
  "Dark mode included — and it's all free",
  'No upload · No account · No watermark · Four looks',
);

await ctx.close();
console.log('screenshots written to release/screenshots/');
