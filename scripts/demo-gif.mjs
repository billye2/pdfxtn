// Record the README demo (~15s, 1280x720 webm): drop → merge → rotate (R) →
// delete → crop (C) → save. Run: npm run build && node scripts/demo-gif.mjs
//   → release/video/readme-demo.webm
// Then convert to the committed docs/demo.gif with ffmpeg (any recent build):
//   ffmpeg -i release/video/readme-demo.webm -vf "fps=9,scale=800:-1:flags=lanczos,palettegen=stats_mode=diff" -y /tmp/pal.png
//   ffmpeg -i release/video/readme-demo.webm -i /tmp/pal.png -lavfi "fps=9,scale=800:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" -y docs/demo.gif
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, rmSync, readdirSync, renameSync, statSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
const outDir = join(here, '..', 'release', 'video', 'demo-rec');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const W = 1280;
const H = 720;

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
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`,
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
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(`chrome-extension://${id}/src/editor/index.html`);
await page.waitForSelector('.drop-zone');

// Big caption pill (GIF is scaled down — text must survive it) + fake cursor.
await page.addStyleTag({
  content: `
    #pv-cursor { position: fixed; left: 0; top: 0; width: 28px; height: 28px;
      z-index: 2147483647; pointer-events: none; transition: transform 0.08s;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35)); }
    #pv-cursor.pv-press { transform: scale(0.8); }
    #pv-caption { position: fixed; left: 50%; top: 146px; transform: translateX(-50%);
      z-index: 2147483646; pointer-events: none; background: rgba(24, 22, 43, 0.92);
      color: #fff; font: 700 30px/1.3 Nunito, 'Helvetica Neue', sans-serif;
      padding: 14px 34px; border-radius: 999px; opacity: 0;
      transition: opacity 0.3s; white-space: nowrap;
      box-shadow: 0 6px 24px rgba(0,0,0,0.3); }
  `,
});
await page.evaluate(() => {
  const cursor = document.createElement('div');
  cursor.id = 'pv-cursor';
  cursor.innerHTML =
    '<svg viewBox="0 0 24 24" width="28" height="28">' +
    '<path d="M5 2 L5 19 L9.5 15 L12.5 21.5 L15.5 20 L12.5 13.5 L18.5 13 Z"' +
    ' fill="#fff" stroke="#18162b" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const caption = document.createElement('div');
  caption.id = 'pv-caption';
  document.body.append(caption, cursor);
});

const caption = (t) =>
  page.evaluate((x) => {
    const el = document.getElementById('pv-caption');
    if (x) el.textContent = x;
    el.style.opacity = x ? '1' : '0';
  }, t);
const pause = (ms) => page.waitForTimeout(ms);
let cur = { x: W / 2, y: H / 2 };
async function glide(x, y, ms = 450) {
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
async function press(d) {
  await page.evaluate(
    (v) => document.getElementById('pv-cursor').classList.toggle('pv-press', v),
    d,
  );
  if (d) await page.mouse.down();
  else await page.mouse.up();
}
async function clickAt(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await glide(box.x + box.width / 2, box.y + box.height / 2);
  await press(true);
  await pause(100);
  await press(false);
}
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
await page.mouse.move(cur.x, cur.y);
await page.evaluate(
  ([x, y]) => {
    const el = document.getElementById('pv-cursor');
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  },
  [cur.x, cur.y],
);

// ---- ~15 seconds ----
await caption('Drop in a PDF');
await pause(400);
await dropPdf('sample.pdf', await samplePdf());
await page.waitForSelector('.card .page-canvas');
await pause(1400);

await caption('Drop another — pages merge in');
await dropPdf('receipts.pdf', await secondPdf());
await page.waitForFunction(() => document.querySelectorAll('.card').length === 9);
await pause(1600);

await caption('Rotate, delete, tidy up');
await clickAt(page.locator('.card').nth(6)); // blue page
await page.keyboard.press('r');
await pause(1000);
const META = process.platform === 'darwin' ? 'Meta' : 'Control';
await page.keyboard.down(META);
await clickAt(page.locator('.card').nth(7));
await page.keyboard.up(META);
await pause(300);
await page.keyboard.press('Delete');
await pause(1100);

await caption('Crop pages visually');
await clickAt(page.locator('.card').nth(0));
await page.keyboard.press('c');
await page.waitForSelector('.crop-canvas');
await pause(400);
const stage = await page.locator('.crop-stage').boundingBox();
await glide(stage.x + stage.width * 0.2, stage.y + stage.height * 0.12, 350);
await press(true);
await glide(stage.x + stage.width * 0.85, stage.y + stage.height * 0.75, 800);
await press(false);
await pause(400);
await clickAt(page.getByRole('button', { name: 'Apply to all' }));
await pause(1200);

await caption('Save — 100% local, nothing uploaded');
const save = await page.getByRole('button', { name: 'Save PDF' }).boundingBox();
await glide(save.x + save.width / 2, save.y + save.height / 2, 600);
await pause(1600);

const video = page.video();
await ctx.close();
const raw = video ? await video.path() : null;
const webms = readdirSync(outDir).filter((f) => f.endsWith('.webm'));
const src = raw ?? `${outDir}/${webms[0]}`;
renameSync(src, join(outDir, '..', 'readme-demo.webm'));
rmSync(outDir, { recursive: true, force: true });
const dest = join(outDir, '..', 'readme-demo.webm');
console.log(`recorded release/video/readme-demo.webm (${statSync(dest).size} bytes)`);
