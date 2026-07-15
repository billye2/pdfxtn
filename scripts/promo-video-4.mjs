// Record promo video v4 (1280x720 webm): one numbered sample PDF walked
// through every core page op — rotate, crop, duplicate, drag-reorder (real
// dnd-kit drags), merge the same file back in, bulk delete, and a real Save.
// Run: npm run build && node scripts/promo-video-4.mjs
//   → release/video/pdf-mana-promo-4.webm  (earlier videos are left untouched)
//   → release/video/sample-numbers-1-7-edited.pdf (the on-camera Save output)
//
// Unlike the e2e suite (where dnd-kit's PointerSensor hangs under synthetic
// dispatched events and the drag test is skipped), slow *trusted* mouse input
// via Playwright's CDP mouse does engage the sensor — verified by probe before
// this script was written. Every drag is still wrapped in a timeout guard with
// a keyboard-nudge fallback so a missed drag can never hang the recording.
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, rmSync, readdirSync, renameSync, statSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const distPath = join(here, '..', 'dist');
const videoDir = join(here, '..', 'release', 'video');
// Record into a temp subdir so picking/renaming the fresh webm can never
// grab or overwrite the earlier webms sitting in release/video/.
const outDir = join(videoDir, 'v4-tmp');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const W = 1280;
const H = 720;
const META = process.platform === 'darwin' ? 'Meta' : 'Control';

// ---- Fixture ----------------------------------------------------------------

// 7 white pages, one huge solid-color numeral (1–7) filling ~80% of each
// page — same document as the repo-root sample-numbers-1-7.pdf, generated
// in-memory like every other promo fixture so the script is self-contained.
const NUMBER_COLORS = [
  null, // no page 0
  [0.0, 0.45, 0.85], // 1 blue
  [0.0, 0.62, 0.28], // 2 green
  [0.95, 0.55, 0.0], // 3 orange
  [0.55, 0.1, 0.75], // 4 purple
  [0.0, 0.65, 0.65], // 5 teal
  [0.9, 0.15, 0.55], // 6 magenta
  [0.45, 0.3, 0.1], // 7 brown
];

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

// ---- Launch + record --------------------------------------------------------

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
// Same rig as promo-video-3.mjs; caption at the TOP because the selection
// dock (bottom-center) features in most beats.
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

async function clickAt(locator, ms = 550) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await glide(box.x + box.width / 2, box.y + box.height / 2, ms);
  await press(true);
  await pause(120);
  await press(false);
}

const cards = () => page.locator('.card');
const waitCards = (n) =>
  page.waitForFunction((c) => document.querySelectorAll('.card').length === c, n);
const dockButton = (name) => page.locator('.dock').getByRole('button', { name });

// Drop one or more PDFs onto the app in a single gesture (order preserved).
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

// ---- Page-order bookkeeping -------------------------------------------------
// Cards carry stable data-page-id; we map each id to the numeral drawn on it
// so every beat can find "the page showing N" no matter where it moved.

const order = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.card')].map((c) => c.dataset.pageId),
  );

const num = new Map(); // pageId -> numeral on that page
const numsNow = async () => (await order()).map((pid) => num.get(pid));

async function expectNums(expected, label) {
  const got = await numsNow();
  if (JSON.stringify(got) !== JSON.stringify(expected)) {
    throw new Error(
      `${label}: page order mismatch\n  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(got)}`,
    );
  }
  console.log(`${label}: ${got.join(' ')}`);
}

// Select exactly one card (Escape first — a plain click on an already-picked
// card would *deselect* it).
async function selectOnly(index) {
  await page.keyboard.press('Escape');
  await clickAt(cards().nth(index));
}

// ---- Drag-reorder: real drag with a guarded keyboard-nudge fallback ---------

const cardByPid = (pid) => page.locator(`.card[data-page-id="${pid}"]`);

// Drag the card `pid` onto the card `targetPid`. The grid reflows (and can
// auto-scroll) mid-drag, so after the travel glide we re-measure the target's
// live rect and settle onto it before releasing.
async function dragPageOnto(pid, targetPid) {
  await cardByPid(targetPid).scrollIntoViewIfNeeded();
  await cardByPid(pid).scrollIntoViewIfNeeded();
  await pause(250);
  const from = await cardByPid(pid).boundingBox();
  await glide(from.x + from.width / 2, from.y + from.height / 2, 500);
  await press(true);
  await pause(180);
  // Exceed the PointerSensor 6px activation distance slowly, then travel.
  await glide(cur.x + 14, cur.y + 6, 220);
  for (let i = 0; i < 6; i += 1) {
    const t = await cardByPid(targetPid).boundingBox();
    const cx = t.x + t.width / 2;
    const cy = t.y + t.height / 2;
    const settled = Math.abs(cx - cur.x) < 3 && Math.abs(cy - cur.y) < 3;
    await glide(cx, cy, i === 0 ? 900 : 260);
    if (settled) break;
  }
  await pause(350);
  await press(false);
  await pause(450);
}

// Put the duplicate right next to its twin: try a real drag; if it hangs,
// cancel it, and if it lands a slot or two off, finish with arrow-key nudges —
// the same reorder the keyboard feature performs. Either side of the twin
// reads the same on camera (identical numerals), so adjacency is the goal.
async function movePairTogether(copyPid, originalPid) {
  const attempt = dragPageOnto(copyPid, originalPid).then(() => 'done');
  const guard = new Promise((r) => setTimeout(() => r('timeout'), 15000));
  if ((await Promise.race([attempt, guard])) === 'timeout') {
    console.warn('drag timed out — cancelling and nudging instead');
    await page.keyboard.press('Escape');
    await press(false);
  }
  let ids = await order();
  if (Math.abs(ids.indexOf(copyPid) - ids.indexOf(originalPid)) !== 1) {
    console.warn(
      `drag left ${num.get(copyPid)} at ${ids.indexOf(copyPid)} (twin at ${ids.indexOf(originalPid)}) — nudging the rest`,
    );
    await selectOnly(ids.indexOf(copyPid));
    while (Math.abs(ids.indexOf(copyPid) - ids.indexOf(originalPid)) !== 1) {
      const key =
        ids.indexOf(copyPid) > ids.indexOf(originalPid) ? 'ArrowLeft' : 'ArrowRight';
      await page.keyboard.press(key);
      await pause(140);
      ids = await order();
    }
    await page.keyboard.press('Escape');
  }
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

// ---- The show: one numbered PDF through every core op -----------------------

const pdfBytes = await numbersPdf();

// Title card
await setCard(
  'PDF Mana',
  'Every page op, one file',
  'Rotate · Crop · Arrange · Merge',
  true,
);
await pause(2800);
await setCard('', '', '', false);
await pause(600);

// Load the numbered sample
await caption('One PDF, pages numbered 1–7');
await dropPdfs([{ name: 'sample-numbers-1-7.pdf', bytes: pdfBytes }]);
await waitCards(7);
await page.waitForSelector('.card .page-canvas');
(await order()).forEach((pid, i) => num.set(pid, i + 1));
await pause(2000);

// Rotate pages 2, 5, 6 — one at a time
await caption('Rotate any page — pick it, one click');
for (const n of [2, 5, 6]) {
  await selectOnly((await numsNow()).indexOf(n));
  await pause(350);
  await clickAt(dockButton('Rotate'));
  await pause(900);
}
await pause(600);

// Crop pages 4, 2, 7 — draw a box, keep it to the picked page
await caption('Crop a page — draw a box, keep the rest untouched');
for (const n of [4, 2, 7]) {
  await selectOnly((await numsNow()).indexOf(n));
  await pause(350);
  await clickAt(dockButton('Crop'));
  await page.waitForSelector('.crop-canvas');
  await pause(500);
  const stage = await page.locator('.crop-stage').boundingBox();
  await glide(stage.x + stage.width * 0.16, stage.y + stage.height * 0.14, 450);
  await press(true);
  await glide(stage.x + stage.width * 0.86, stage.y + stage.height * 0.84, 900);
  await press(false);
  await pause(600);
  await clickAt(page.getByRole('button', { name: 'Keep 1 picked' }));
  await page.waitForSelector('.crop-canvas', { state: 'detached' });
  await pause(800);
}
await pause(400);

// Duplicate pages 4–7 (copies land right after their originals)
await caption('Duplicate a whole range');
await page.keyboard.press('Escape');
await clickAt(cards().nth(3));
await page.keyboard.down('Shift');
await clickAt(cards().nth(6));
await page.keyboard.up('Shift');
await pause(500);
await clickAt(dockButton('Duplicate'));
await waitCards(11);
// Register the four new ids: each copy sits right after its original.
{
  const ids = await order();
  ids.forEach((pid, i) => {
    if (!num.has(pid)) num.set(pid, num.get(ids[i - 1]));
  });
}
const idsAfterDup = await order();
const copies = [4, 6, 8, 10].map((i) => idsAfterDup[i]);
await expectNums([1, 2, 3, 4, 4, 5, 5, 6, 6, 7, 7], 'after duplicate');
await pause(1400);

// Scramble the copies to the end so the drag beat has real work to do
await caption('Copies land next to their originals — let’s scramble them…');
await page.keyboard.press('Escape');
for (const pid of copies) {
  let at = (await order()).indexOf(pid);
  await selectOnly(at);
  while (at < 10) {
    await page.keyboard.press('ArrowRight');
    await pause(90);
    at = (await order()).indexOf(pid);
  }
}
await page.keyboard.press('Escape');
await expectNums([1, 2, 3, 4, 5, 6, 7, 4, 5, 6, 7], 'after scramble');
await pause(1200);

// …and drag them back into pairs: 4-4 5-5 6-6 7-7
await caption('…and drag them back into place');
for (const [copyIdx, n] of [
  [0, 4],
  [1, 5],
  [2, 6],
]) {
  const copyPid = copies[copyIdx];
  const originalPid = (await order()).find(
    (pid) => num.get(pid) === n && pid !== copyPid,
  );
  await movePairTogether(copyPid, originalPid);
  await pause(700);
}
await expectNums([1, 2, 3, 4, 4, 5, 5, 6, 6, 7, 7], 'after drag-reorder');
await pause(1400);

// Add the same PDF again — pages append at the end
await caption('Add the same PDF again — new pages append');
await page.keyboard.press('Escape');
const chooser = page.waitForEvent('filechooser');
await clickAt(page.locator('.toolbar').getByRole('button', { name: 'Add PDF' }));
await (
  await chooser
).setFiles({
  name: 'sample-numbers-1-7.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from(pdfBytes),
});
await waitCards(18);
await page.waitForSelector('.card .page-canvas');
{
  const ids = await order();
  ids.forEach((pid, i) => {
    if (!num.has(pid)) num.set(pid, i - 10);
  });
}
await pause(2000);

// Pick every odd-numbered page and delete them in one go
await caption('Pick every odd page… and delete them in one go');
const odd = (await numsNow())
  .map((n, i) => [n, i])
  .filter(([n]) => n % 2 === 1)
  .map(([, i]) => i);
await selectOnly(odd[0]);
await page.keyboard.down(META);
for (const i of odd.slice(1)) {
  await clickAt(cards().nth(i), 260);
}
await page.keyboard.up(META);
await pause(900);
await clickAt(dockButton('Delete'));
await waitCards(8);
await expectNums([2, 4, 4, 6, 6, 2, 4, 6], 'after deleting odds');
await pause(1600);

// Save one combined PDF — a real download, export progress on camera
await caption('Save it all as one combined PDF');
const download = page.waitForEvent('download');
await clickAt(page.getByRole('button', { name: 'Save PDF' }));
const dl = await download;
await dl.saveAs(join(videoDir, 'sample-numbers-1-7-edited.pdf'));
await pause(2200);
await caption('');

// End card
await setCard(
  'PDF Mana',
  'No upload · No account · No watermark',
  'Free on the Chrome Web Store',
  true,
);
await pause(3200);

const video = page.video();
await ctx.close();

// Playwright writes a hash-named webm; give it a stable name next to v1–v3's.
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
const dest = join(videoDir, 'pdf-mana-promo-4.webm');
renameSync(src, dest);
rmSync(outDir, { recursive: true, force: true });
console.log(
  `promo video v4 written to release/video/pdf-mana-promo-4.webm (${statSync(dest).size} bytes)`,
);
