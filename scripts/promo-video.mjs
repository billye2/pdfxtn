// Record a Chrome Web Store promo video (1280x720 webm) of the built extension.
// Run: npm run build && node scripts/promo-video.mjs  → release/video/pdf-mana-promo.webm
// Upload the webm to YouTube, then paste the URL into the CWS "Promotional video" field.
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, rmSync, readdirSync, renameSync, statSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const distPath = join(here, '..', 'dist');
const outDir = join(here, '..', 'release', 'video');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const W = 1280;
const H = 720;

// Same document-like sample as scripts/screenshots.mjs so thumbnails look real.
async function samplePdf() {
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

// A second, visually distinct document (blue header band + blue-grey lines) so
// the merged-in pages are easy to spot among the first document's white pages.
async function secondPdf() {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const titles = ['Lab Results', 'Receipt', 'Boarding Pass'];
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

const ctx = await chromium.launchPersistentContext('', {
  headless: false,
  args: [
    '--headless=new',
    '--no-sandbox',
    `--disable-extensions-except=${distPath}`,
    `--load-extension=${distPath}`,
  ],
  viewport: { width: W, height: H },
  recordVideo: { dir: outDir, size: { width: W, height: H } },
});

let sw = ctx.serviceWorkers()[0];
for (let i = 0; i < 40 && !sw; i += 1) {
  await new Promise((r) => setTimeout(r, 250));
  sw = ctx.serviceWorkers()[0];
}
const id = sw.url().split('/')[2];

// Reuse the context's initial page so exactly one video file is produced.
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(`chrome-extension://${id}/src/editor/index.html`);

// ---- Presentation layer: caption pill, fake cursor, title/end cards -------
// Synthetic input renders no cursor, so a fake one glides alongside the real
// mouse. Everything lives above the app's modals (z-index max).
await page.addStyleTag({
  content: `
    #pv-cursor { position: fixed; left: 0; top: 0; width: 26px; height: 26px;
      z-index: 2147483647; pointer-events: none; transition: transform 0.08s;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35)); }
    #pv-cursor.pv-press { transform: scale(0.8); }
    #pv-caption { position: fixed; left: 50%; bottom: 34px; transform: translateX(-50%);
      z-index: 2147483646; pointer-events: none; background: rgba(24, 22, 43, 0.88);
      color: #fff; font: 600 21px/1.35 Nunito, 'Helvetica Neue', sans-serif;
      padding: 12px 26px; border-radius: 999px; opacity: 0;
      transition: opacity 0.35s; white-space: nowrap;
      box-shadow: 0 6px 24px rgba(0,0,0,0.25); }
    #pv-card { position: fixed; inset: 0; z-index: 2147483645; pointer-events: none;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 14px; background: linear-gradient(135deg, #ff8369, #e94b43);
      opacity: 0; transition: opacity 0.5s; text-align: center;
      font-family: Fredoka, Nunito, 'Helvetica Neue', sans-serif; color: #fff; }
    #pv-card .pv-title { font-size: 68px; font-weight: 700; letter-spacing: 0.5px; }
    #pv-card .pv-tag { font-size: 28px; font-weight: 600; opacity: 0.95; }
    #pv-card .pv-sub { font-size: 20px; font-weight: 500; opacity: 0.85; margin-top: 6px; }
  `,
});
await page.evaluate(() => {
  const cursor = document.createElement('div');
  cursor.id = 'pv-cursor';
  cursor.innerHTML =
    '<svg viewBox="0 0 24 24" width="26" height="26">' +
    '<path d="M5 2 L5 19 L9.5 15 L12.5 21.5 L15.5 20 L12.5 13.5 L18.5 13 Z"' +
    ' fill="#fff" stroke="#18162b" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const caption = document.createElement('div');
  caption.id = 'pv-caption';
  const card = document.createElement('div');
  card.id = 'pv-card';
  // The white rounded "M" mark, matching scripts/promo.mjs.
  card.innerHTML =
    '<svg width="120" height="120" viewBox="0 0 128 128">' +
    '<rect width="128" height="128" rx="30" fill="#ffffff"/>' +
    '<path d="M 34 92 L 34 40 L 64 71 L 94 40 L 94 92" fill="none" stroke="#e94b43"' +
    ' stroke-width="14" stroke-linejoin="round" stroke-linecap="round"/></svg>' +
    '<div class="pv-title"></div><div class="pv-tag"></div><div class="pv-sub"></div>';
  document.body.append(card, caption, cursor);
});

const setCard = (title, tag, sub, visible) =>
  page.evaluate(
    ([t, g, s, v]) => {
      const card = document.getElementById('pv-card');
      card.querySelector('.pv-title').textContent = t;
      card.querySelector('.pv-tag').textContent = g;
      card.querySelector('.pv-sub').textContent = s;
      card.style.opacity = v ? '1' : '0';
    },
    [title, tag, sub, visible],
  );

const caption = (text) =>
  page.evaluate((t) => {
    const el = document.getElementById('pv-caption');
    if (t) el.textContent = t;
    el.style.opacity = t ? '1' : '0';
  }, text);

const pause = (ms) => page.waitForTimeout(ms);

let cur = { x: W / 2, y: H / 2 };
async function glide(x, y, ms = 550) {
  await page.evaluate(
    ([tx, ty, dur]) => {
      const el = document.getElementById('pv-cursor');
      el.style.transition = `transform 0.08s, left ${dur}ms cubic-bezier(0.3,0,0.2,1), top ${dur}ms cubic-bezier(0.3,0,0.2,1)`;
      el.style.left = `${tx}px`;
      el.style.top = `${ty}px`;
    },
    [x, y, ms],
  );
  await page.mouse.move(x, y, { steps: Math.max(8, Math.round(ms / 25)) });
  cur = { x, y };
  await pause(ms);
}

async function press(down) {
  await page.evaluate((d) => {
    document.getElementById('pv-cursor').classList.toggle('pv-press', d);
  }, down);
  if (down) await page.mouse.down();
  else await page.mouse.up();
}

async function clickAt(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await glide(box.x + box.width / 2, box.y + box.height / 2);
  await press(true);
  await pause(120);
  await press(false);
}

// Position the fake cursor at its starting point before anything is visible.
await page.mouse.move(cur.x, cur.y);
await page.evaluate(
  ([x, y]) => {
    const el = document.getElementById('pv-cursor');
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  },
  [cur.x, cur.y],
);

// ---- The show --------------------------------------------------------------

// 1) Title card
await setCard(
  'PDF Mana',
  'Merge · Arrange · Nip & Adjust',
  'Edit PDF pages — 100% on your device',
  true,
);
await pause(2800);
await setCard('', '', '', false);
await pause(600);

async function dropPdf(name, bytes) {
  const dt = await page.evaluateHandle(
    ([b, n]) => {
      const d = new DataTransfer();
      d.items.add(new File([new Uint8Array(b)], n, { type: 'application/pdf' }));
      return d;
    },
    [bytes, name],
  );
  await page.dispatchEvent('.app', 'dragover', { dataTransfer: dt });
  await page.dispatchEvent('.app', 'drop', { dataTransfer: dt });
}

// 2) Load a PDF
await caption('Drop in a PDF — it never leaves your device');
await dropPdf('sample.pdf', await samplePdf());
await page.waitForSelector('.card .page-canvas');
await pause(2200);

// 3) Merge a second PDF (its blue pages land after the white ones)
await caption('Merging? Just drop in another PDF');
await dropPdf('receipts.pdf', await secondPdf());
await page.waitForFunction(() => document.querySelectorAll('.card').length === 9);
await pause(2400);

// 4) Rotate a page, then move it — the landscape blue card is easy to follow
// as it travels. (Keyboard nudge: dnd-kit's PointerSensor hangs under
// synthetic drags.)
await caption('Rotate a page — then move it where it belongs');
await clickAt(page.locator('.card').nth(6));
await pause(400);
await clickAt(page.locator('.toolbar').getByRole('button', { name: 'Rotate' }));
await pause(1100);
await page.keyboard.press('ArrowLeft');
await pause(800);
await page.keyboard.press('ArrowLeft');
await pause(1300);

// 5) Multi-select + delete
await caption('Pick a few pages — delete what you don’t need');
const META = process.platform === 'darwin' ? 'Meta' : 'Control';
await clickAt(page.locator('.card').nth(5)); // plain click resets the selection
await page.keyboard.down(META);
await clickAt(page.locator('.card').nth(6));
await page.keyboard.up(META);
await pause(400);
await clickAt(page.locator('.toolbar').getByRole('button', { name: 'Delete' }));
await pause(1400);

// 6) Split every N
await caption('Split into separate PDFs');
await clickAt(page.getByRole('button', { name: 'Split every…' }));
await page.waitForSelector('.split-n');
await clickAt(page.locator('.split-n'));
await page.locator('.split-n').fill('2');
await pause(700);
await clickAt(page.getByRole('button', { name: 'Apply split marks' }));
await pause(1500);

// 7) Crop
await caption('Crop pages visually');
await clickAt(page.locator('.btn-crop'));
await page.waitForSelector('.crop-canvas');
await pause(500);
const stage = await page.locator('.crop-stage').boundingBox();
await glide(stage.x + stage.width * 0.2, stage.y + stage.height * 0.12, 450);
await press(true);
await glide(stage.x + stage.width * 0.85, stage.y + stage.height * 0.75, 1100);
await press(false);
await pause(800);
await clickAt(page.getByRole('button', { name: 'Apply to all' }));
await pause(1600);

// 8) Lightbox preview
await caption('Preview pages up close');
const firstCard = await page.locator('.card').nth(0).boundingBox();
await glide(firstCard.x + firstCard.width / 2, firstCard.y + firstCard.height / 2);
await page.locator('.card').nth(0).dblclick();
await page.waitForSelector('.lightbox-canvas');
await pause(1400);
await page.keyboard.press('ArrowRight');
await pause(1100);
await page.keyboard.press('ArrowRight');
await pause(1100);
await page.keyboard.press('Escape');
await pause(400);

// 9) Theme flourish — end on the dark theme so the save beat shows it off
await caption('Pick your look');
await clickAt(page.locator('.look-trigger'));
await pause(500);
await clickAt(page.locator('.look-option', { hasText: 'Bubble' }));
await pause(1400);
await caption('…including a dark mode');
await clickAt(page.locator('.look-trigger'));
await pause(500);
await clickAt(page.locator('.look-option', { hasText: 'Nighty Night' }));
await pause(1800);

// 10) Save beat (hover only — no need to trigger real downloads on camera)
await caption('Save — and you’re done');
const save = await page.getByRole('button', { name: 'Save PDF' }).boundingBox();
await glide(save.x + save.width / 2, save.y + save.height / 2, 700);
await pause(1300);
await caption('');

// 11) End card
await setCard(
  'PDF Mana',
  '100% local — nothing ever leaves your device',
  'Free on the Chrome Web Store',
  true,
);
await pause(3200);

const video = page.video();
await ctx.close();

// Playwright writes a hash-named webm; give it a stable name.
const raw = video ? await video.path() : null;
const webms = readdirSync(outDir).filter((f) => f.endsWith('.webm'));
const src =
  raw ??
  join(
    outDir,
    webms.sort(
      (a, b) => statSync(join(outDir, b)).size - statSync(join(outDir, a)).size,
    )[0],
  );
const dest = join(outDir, 'pdf-mana-promo.webm');
renameSync(src, dest);
console.log(
  `promo video written to release/video/pdf-mana-promo.webm (${statSync(dest).size} bytes)`,
);
