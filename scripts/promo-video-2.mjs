// Record promo video v2 (1280x720 webm): the page-editing toolkit — rotate,
// crop, duplicate, blank page, delete, keep-these — told through the
// selection dock. Run: npm run build && node scripts/promo-video-2.mjs
//   → release/video/pdf-mana-promo-2.webm  (v1's file is left untouched)
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, rmSync, readdirSync, renameSync, statSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const distPath = join(here, '..', 'dist');
const videoDir = join(here, '..', 'release', 'video');
// Record into a temp subdir so picking/renaming the fresh webm can never
// grab or overwrite v1's pdf-mana-promo.webm sitting in release/video/.
const outDir = join(videoDir, 'v2-tmp');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const W = 1280;
const H = 720;

// The numbered sample (same document as the repo-root sample-numbers-1-7.pdf,
// generated in-memory like every other promo fixture): 7 white pages, one huge
// solid-color numeral each, so every page op reads instantly at thumbnail size.
const NUMBER_COLORS = {
  1: [0.0, 0.45, 0.85], // blue
  2: [0.0, 0.62, 0.28], // green
  3: [0.95, 0.55, 0.0], // orange
  4: [0.55, 0.1, 0.75], // purple
  5: [0.0, 0.65, 0.65], // teal
  6: [0.9, 0.15, 0.55], // magenta
  7: [0.45, 0.3, 0.1], // brown
};

async function samplePdf() {
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
// Same rig as promo-video.mjs, except the caption sits at the TOP: this cut
// stars the selection dock, which lives bottom-center where v1's pill was.
await page.addStyleTag({
  content: `
    #pv-cursor { position: fixed; left: 0; top: 0; width: 26px; height: 26px;
      z-index: 2147483647; pointer-events: none; transition: transform 0.08s;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35)); }
    #pv-cursor.pv-press { transform: scale(0.8); }
    #pv-caption { position: fixed; left: 50%; top: 148px; transform: translateX(-50%);
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

const cards = () => page.locator('.card');
const waitCards = (n) =>
  page.waitForFunction((c) => document.querySelectorAll('.card').length === c, n);
const dockButton = (name) => page.locator('.dock').getByRole('button', { name });

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
  'Rotate · Crop · Duplicate · Tidy up',
  'Page tools — 100% on your device',
  true,
);
await pause(2800);
await setCard('', '', '', false);
await pause(600);

// 2) Load a PDF
await caption('Drop in a PDF — it never leaves your device');
const dt = await page.evaluateHandle(
  ([b, n]) => {
    const d = new DataTransfer();
    d.items.add(new File([new Uint8Array(b)], n, { type: 'application/pdf' }));
    return d;
  },
  [await samplePdf(), 'sample-numbers-1-7.pdf'],
);
await page.dispatchEvent('.app', 'dragover', { dataTransfer: dt });
await page.dispatchEvent('.app', 'drop', { dataTransfer: dt });
await page.waitForSelector('.card .page-canvas');
await pause(2000);

// 3) Rotate — pick a page, the dock appears, spin it sideways
await caption('Pick a page — the dock has every tool');
await clickAt(cards().nth(1));
await page.waitForSelector('.dock');
await pause(900);
await caption('Rotate it upright');
await clickAt(dockButton('Rotate'));
await pause(1600);

// 4) Crop — draw one box, apply everywhere
await caption('Crop — draw once, apply everywhere');
await clickAt(dockButton('Crop'));
await page.waitForSelector('.crop-canvas');
await pause(500);
const stage = await page.locator('.crop-stage').boundingBox();
await glide(stage.x + stage.width * 0.2, stage.y + stage.height * 0.12, 450);
await press(true);
await glide(stage.x + stage.width * 0.85, stage.y + stage.height * 0.75, 1100);
await press(false);
await pause(700);
await clickAt(page.getByRole('button', { name: 'Apply to all' }));
await pause(1600);

// 5) Duplicate — the copy lands right after the original
await caption('Duplicate a page in one click');
await clickAt(cards().nth(0));
await pause(500);
await clickAt(dockButton('Duplicate'));
await waitCards(8);
await pause(1700);

// 6) Blank page — inserted after the picked page, same size
await caption('Need a spacer? Slip in a blank page');
await clickAt(dockButton('Blank page'));
await waitCards(9);
await pause(1700);

// 7) Delete a couple of pages — numbers 6 and 7 visibly vanish
await caption("Delete what you don't need");
const META = process.platform === 'darwin' ? 'Meta' : 'Control';
await clickAt(cards().nth(7));
await page.keyboard.down(META);
await clickAt(cards().nth(8));
await page.keyboard.up(META);
await pause(500);
await clickAt(dockButton('Delete'));
await waitCards(7);
await pause(1500);

// 8) Keep these — extract just the pages you want
await caption('…or keep only the pages you want');
await clickAt(cards().nth(3));
await page.keyboard.down('Shift');
await clickAt(cards().nth(5));
await page.keyboard.up('Shift');
await pause(600);
await clickAt(dockButton('Keep these'));
await waitCards(3);
await pause(1800);

// 9) Save beat (hover only — no need to trigger real downloads on camera)
await caption('Save — and you’re done');
const save = await page.getByRole('button', { name: 'Save PDF' }).boundingBox();
await glide(save.x + save.width / 2, save.y + save.height / 2, 700);
await pause(1300);
await caption('');

// 10) End card
await setCard(
  'PDF Mana',
  '100% local — nothing ever leaves your device',
  'Free on the Chrome Web Store',
  true,
);
await pause(3200);

const video = page.video();
await ctx.close();

// Playwright writes a hash-named webm; give it a stable name next to v1's.
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
const dest = join(videoDir, 'pdf-mana-promo-2.webm');
renameSync(src, dest);
rmSync(outDir, { recursive: true, force: true });
console.log(
  `promo video v2 written to release/video/pdf-mana-promo-2.webm (${statSync(dest).size} bytes)`,
);
