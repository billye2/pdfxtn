// Generate Chrome Web Store screenshots (1280x800) of the built extension.
// Each shot is a branded frame: gradient background + benefit headline, with
// the live UI (captured 1:1 at 1050x640) inset below. Run:
//   npm run build && node scripts/screenshots.mjs  → release/screenshots/*.png
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
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

// ---- Fixtures (same as scripts/promo-video-3.mjs) ---------------------------

// Grey-bar "office paper" pages (title + faux text lines).
function paperPage(doc, bold, title, seed) {
  const p = doc.addPage([612, 792]);
  p.drawText(title, {
    x: 56,
    y: 712,
    size: 26,
    font: bold,
    color: rgb(0.13, 0.12, 0.25),
  });
  for (let l = 0; l < 22; l += 1) {
    const w = 360 + ((seed * 7 + l * 13) % 130);
    p.drawRectangle({
      x: 56,
      y: 672 - l * 26,
      width: w,
      height: 9,
      color: rgb(0.86, 0.87, 0.91),
    });
  }
  return p;
}

// One page each so the hero board is a single, fully visible row of 4 cards.
async function contractPdf() {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  paperPage(doc, bold, 'Contract', 0);
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

async function sixPager() {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  [
    'Quarterly Report',
    'Invoice #1042',
    'Project Brief',
    'Meeting Notes',
    'Appendix A',
    'Contract',
  ].forEach((t, i) => paperPage(doc, bold, t, i));
  return [...(await doc.save())];
}

// A 3-page "scan": pages 1/3 carry dark scanner-shadow bands along the right
// and bottom edges; page 2's content is drawn rotated 90° CCW (sideways).
async function messyScanPdf() {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const shadow = (p) => {
    p.drawRectangle({
      x: 594,
      y: 0,
      width: 18,
      height: 792,
      color: rgb(0.32, 0.32, 0.36),
    });
    p.drawRectangle({
      x: 0,
      y: 0,
      width: 612,
      height: 16,
      color: rgb(0.32, 0.32, 0.36),
    });
  };
  shadow(paperPage(doc, bold, 'Scanned Notes', 0));
  const sideways = doc.addPage([612, 792]);
  sideways.drawText('Meeting Notes', {
    x: 82,
    y: 90,
    size: 26,
    font: bold,
    color: rgb(0.13, 0.12, 0.25),
    rotate: degrees(90),
  });
  for (let l = 0; l < 14; l += 1) {
    sideways.drawRectangle({
      x: 130 + l * 26,
      y: 90,
      width: 9,
      height: 420 + ((l * 17) % 160),
      color: rgb(0.86, 0.87, 0.91),
    });
  }
  shadow(sideways);
  shadow(paperPage(doc, bold, 'Scanned Notes — p.3', 2));
  return [...(await doc.save())];
}

// The Mix stars: huge numerals. Fronts = 1,3,5; backs = 6,4,2 (flipped stack).
function numeralPage(doc, bold, n, { tint, ink, label }) {
  const p = doc.addPage([612, 792]);
  if (tint) p.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: tint });
  p.drawText(label, { x: 40, y: 736, size: 24, font: bold, color: ink });
  p.drawText(String(n), { x: 205, y: 230, size: 380, font: bold, color: ink });
}

async function frontsPdf() {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const style = { ink: rgb(0.13, 0.12, 0.25), label: 'FRONTS' };
  [1, 3, 5].forEach((n) => numeralPage(doc, bold, n, style));
  return [...(await doc.save())];
}

async function backsPdf() {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const style = {
    tint: rgb(0.85, 0.91, 0.99),
    ink: rgb(0.09, 0.28, 0.6),
    label: 'BACKS',
  };
  [6, 4, 2].forEach((n) => numeralPage(doc, bold, n, style));
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

// Colorful "photos" generated in-page (canvas → PNG File) and dropped.
async function dropPhotos(count = 3) {
  const dt = await page.evaluateHandle(async (n) => {
    const specs = [
      ['Photo 1', '#0ea5a3', '#4338ca'],
      ['Photo 2', '#f97316', '#ec4899'],
      ['Photo 3', '#22c55e', '#0891b2'],
    ].slice(0, n);
    const d = new DataTransfer();
    for (const [label, c1, c2] of specs) {
      const cv = document.createElement('canvas');
      cv.width = 800;
      cv.height = 600;
      const g = cv.getContext('2d');
      const grad = g.createLinearGradient(0, 0, 800, 600);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      g.fillStyle = grad;
      g.fillRect(0, 0, 800, 600);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.beginPath();
      g.arc(620, 160, 120, 0, 7);
      g.fill();
      g.fillStyle = '#fff';
      g.font = '700 64px Nunito, sans-serif';
      g.fillText(label, 48, 520);
      const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
      d.items.add(
        new File([blob], `${label.toLowerCase().replace(' ', '-')}.png`, {
          type: 'image/png',
        }),
      );
    }
    return d;
  }, count);
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

// 1) Hero — one clean row of visibly mixed content (two PDFs + two photos).
await dropPdfs([
  { name: 'contract.pdf', bytes: await contractPdf() },
  { name: 'receipt.pdf', bytes: await receiptPdf() },
]);
await waitCards(2);
await dropPhotos(2);
await waitCards(4);
await settle();
await shoot(
  '01-hero.png',
  'Tidy up any PDF — right in your browser',
  'Merge, reorder, rotate, crop & split pages. Nothing is ever uploaded.',
);

// 5) Same board in the dark look (shot now while the content is up).
await page.locator('.look-trigger').click();
await page.locator('.look-option', { hasText: 'Nighty Night' }).click();
await page.waitForTimeout(500);
await shoot(
  '05-dark-free.png',
  "Dark mode included — and it's all free",
  'No upload · No account · No watermark · Four looks',
);
await page.locator('.look-trigger').click();
await page.locator('.look-option', { hasText: 'Blocks' }).click();
await page.waitForTimeout(400);
await resetSession();

// 2) Page tools — three pages picked, the selection dock up.
await dropPdfs([{ name: 'report.pdf', bytes: await sixPager() }]);
await waitCards(6);
await settle();
// Pick the first three cards (all in the top row, so nothing scrolls).
await page.locator('.card').nth(0).click();
await page
  .locator('.card')
  .nth(1)
  .click({ modifiers: ['ControlOrMeta'] });
await page
  .locator('.card')
  .nth(2)
  .click({ modifiers: ['ControlOrMeta'] });
await page.waitForTimeout(400);
await shoot(
  '02-page-tools.png',
  'Pick pages — fix them in one click',
  'Rotate · Crop · Duplicate · Blank page · Keep · Delete',
);
await page.keyboard.press('Escape');
await resetSession();

// 3) Double-sided scans — fronts/backs stacks with the Mix dialog open.
await dropPdfs([
  { name: 'fronts.pdf', bytes: await frontsPdf() },
  { name: 'backs.pdf', bytes: await backsPdf() },
]);
await waitCards(6);
await settle();
await page.locator('.toolbar').getByRole('button', { name: 'Mix' }).click();
await page.waitForSelector('.mix-modal');
await page.waitForTimeout(400);
await shoot(
  '03-double-sided.png',
  'Un-scramble double-sided scans',
  'Mix fronts & backs into reading order — or un-mix them — in one click',
);
await page.keyboard.press('Escape');
await resetSession();

// 4) Scan rescue — the crop dialog with a box that nips off the shadow bands.
await dropPdfs([{ name: 'scan.pdf', bytes: await messyScanPdf() }]);
await waitCards(3);
await settle();
await page.locator('.card').nth(1).click();
await page.locator('.dock').getByRole('button', { name: 'Crop' }).click();
await page.waitForSelector('.crop-canvas');
await page.waitForTimeout(300);
const stage = await page.locator('.crop-stage').boundingBox();
await page.mouse.move(stage.x + stage.width * 0.05, stage.y + stage.height * 0.04);
await page.mouse.down();
await page.mouse.move(stage.x + stage.width * 0.94, stage.y + stage.height * 0.93, {
  steps: 10,
});
await page.mouse.up();
await page.waitForTimeout(300);
await shoot(
  '04-crop.png',
  'Rescue messy scans',
  'Nip off scanner shadows — draw one box, apply it to every page',
);

await ctx.close();
console.log('screenshots written to release/screenshots/');
