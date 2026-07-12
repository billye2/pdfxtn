// Record promo video v3 (1280x720 webm): the six README use cases — stitch
// paperwork, rescue a messy scan, tame a double-sided scan (Mix / Un-mix),
// send only what's needed, work with images, and keep it all on-device.
// Run: npm run build && node scripts/promo-video-3.mjs
//   → release/video/pdf-mana-promo-3.webm  (v1/v2 files are left untouched)
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, rmSync, readdirSync, renameSync, statSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const distPath = join(here, '..', 'dist');
const videoDir = join(here, '..', 'release', 'video');
// Record into a temp subdir so picking/renaming the fresh webm can never
// grab or overwrite the v1/v2 webms sitting in release/video/.
const outDir = join(videoDir, 'v3-tmp');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const W = 1280;
const H = 720;
const META = process.platform === 'darwin' ? 'Meta' : 'Control';

// ---- Fixtures ---------------------------------------------------------------

// Grey-bar "office paper" pages, same styling as samplePdf in promo-video-2.
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

async function paperStackA() {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  ['Contract', 'Cover Letter', 'Invoice #1042'].forEach((t, i) =>
    paperPage(doc, bold, t, i),
  );
  return [...(await doc.save())];
}

// Blue-tinted pages (promo-video v1's secondPdf styling) so the merged-in
// stack is instantly distinguishable while it travels through the grid.
async function paperStackB() {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const titles = ['Receipt', 'Boarding Pass'];
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

// A 3-page "scan": pages 1/3 carry dark scanner-shadow bands along the right
// and bottom edges (so the crop visibly removes them); page 2's content is
// drawn rotated 90° CCW so one clockwise Rotate click rights it on camera.
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
    p.drawRectangle({ x: 0, y: 0, width: 612, height: 16, color: rgb(0.32, 0.32, 0.36) });
  };
  shadow(paperPage(doc, bold, 'Scanned Notes', 0));
  // Laid out so one clockwise rotate reads naturally: raw bottom-left maps to
  // the rotated view's top-left, so the title goes there and the "text lines"
  // (vertical bars) sit at increasing x — below the title once rotated.
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

// The Mix stars: huge numerals so interleaving reads at thumbnail size.
// Fronts = 1,3,5. Backs = 6,4,2 (a flipped stack scans last-back-first);
// the double-sided preset reverses the 2nd doc, so Mix yields 1,2,3,4,5,6.
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

// The familiar 6-titled-pages document (same as promo-video-2's samplePdf).
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
// Same rig as promo-video-2.mjs; caption at the TOP because the selection
// dock (bottom-center) features in several scenes.
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

// Generate three colorful "photos" in-page (canvas → PNG File) and drop them.
async function dropPhotos() {
  const dt = await page.evaluateHandle(async () => {
    const specs = [
      ['Photo 1', '#0ea5a3', '#4338ca'],
      ['Photo 2', '#f97316', '#ec4899'],
      ['Photo 3', '#22c55e', '#0891b2'],
    ];
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
  });
  await page.dispatchEvent('.app', 'dragover', { dataTransfer: dt });
  await page.dispatchEvent('.app', 'drop', { dataTransfer: dt });
}

// Clear the grid between scenes: select-all + Delete keeps the editor (and
// the injected presentation rig) alive — no reload, no restore banner.
async function resetSession() {
  await caption('');
  await pause(300);
  await page.keyboard.press(`${META}+a`);
  await pause(200);
  await page.keyboard.press('Delete');
  await waitCards(0);
  await pause(450);
}

async function hoverSave(ms = 1100) {
  const save = await page.getByRole('button', { name: 'Save PDF' }).boundingBox();
  await glide(save.x + save.width / 2, save.y + save.height / 2, 700);
  await pause(ms);
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

// ---- The show: one scene per README use case -------------------------------

// Title card
await setCard('PDF Mana', 'Six everyday PDF jobs', '100% on your device', true);
await pause(2800);
await setCard('', '', '', false);
await pause(600);

// 1) Stitching paperwork together
await caption('Stitch paperwork together — drop it all in');
await dropPdfs([
  { name: 'contract.pdf', bytes: await paperStackA() },
  { name: 'receipts.pdf', bytes: await paperStackB() },
]);
await waitCards(5);
await page.waitForSelector('.card .page-canvas');
await pause(1800);
await caption('Pages append — nudge them into order');
await clickAt(cards().nth(3)); // the blue Receipt
await pause(400);
await page.keyboard.press('ArrowLeft');
await pause(800);
await page.keyboard.press('ArrowLeft');
await pause(1200);
await caption('Save one clean PDF');
await page.keyboard.press('Escape'); // clear the selection for a tidy save beat
await hoverSave();
await resetSession();

// 2) Rescuing a messy scan
await caption('Rescue a messy scan');
await dropPdfs([{ name: 'scan.pdf', bytes: await messyScanPdf() }]);
await waitCards(3);
await page.waitForSelector('.card .page-canvas');
await pause(1600);
await caption('Turn the sideways page right-side up');
await clickAt(cards().nth(1));
await page.waitForSelector('.dock');
await pause(500);
await clickAt(dockButton('Rotate'));
await pause(1500);
await caption('Nip off the scanner shadow — crop once, apply to all');
await clickAt(dockButton('Crop'));
await page.waitForSelector('.crop-canvas');
await pause(500);
// A near-full-page box: just nip the shadow bands off the edges without
// clipping the page titles (top ~4% and right/bottom ~6% go).
const stage = await page.locator('.crop-stage').boundingBox();
await glide(stage.x + stage.width * 0.05, stage.y + stage.height * 0.04, 450);
await press(true);
await glide(stage.x + stage.width * 0.94, stage.y + stage.height * 0.93, 1000);
await press(false);
await pause(700);
await clickAt(page.getByRole('button', { name: 'Apply to all' }));
await pause(1300);
await caption('The feeder ate a page? Slip in a blank');
await clickAt(cards().nth(1)); // re-pick so the blank lands after this page
await pause(400);
await clickAt(dockButton('Blank page'));
await waitCards(4);
await pause(1600);
await resetSession();

// 3) Taming double-sided scans (Mix / Un-mix)
await caption('Double-sided scan? Fronts… then backs, in reverse');
await dropPdfs([
  { name: 'fronts.pdf', bytes: await frontsPdf() },
  { name: 'backs.pdf', bytes: await backsPdf() },
]);
await waitCards(6);
await page.waitForSelector('.card .page-canvas');
await pause(2000);
await caption('Mix — one click for the flip-the-stack scan');
await clickAt(page.locator('.toolbar').getByRole('button', { name: 'Mix' }));
await page.waitForSelector('.mix-modal');
await pause(700);
await clickAt(page.getByRole('button', { name: 'Use double-sided scan preset' }));
await pause(800);
await clickAt(page.getByRole('button', { name: 'Mix pages' }));
await page.waitForSelector('.mix-modal', { state: 'detached' });
await pause(500);
await caption('Sorted into reading order');
await pause(2000);
await caption('Changed your mind? Un-mix pulls it back apart');
await clickAt(page.locator('.toolbar').getByRole('button', { name: 'Mix' }));
await page.waitForSelector('.mix-modal');
await pause(600);
await clickAt(
  page
    .getByRole('group', { name: 'Mode' })
    .getByRole('button', { name: 'Un-mix', exact: true }),
);
await pause(600);
await clickAt(page.getByRole('button', { name: 'Un-mix pages' }));
await page.waitForSelector('.mix-modal', { state: 'detached' });
await pause(1800);
// Undo the un-mix before resetting: its split mark lives in splitMarks, which
// select-all + Delete leaves behind — stale marks would badge every page of
// the NEXT scene's document with "Part 1".
await page.keyboard.press(`${META}+z`);
await pause(300);
await resetSession();

// 4) Sending only what's needed
await caption("Send only what's needed");
await dropPdfs([{ name: 'report.pdf', bytes: await sixPager() }]);
await waitCards(6);
await page.waitForSelector('.card .page-canvas');
await pause(1300);
await caption('Grab any page range by position');
await clickAt(page.getByRole('button', { name: 'Export range…' }));
await page.waitForSelector('.range-input');
await pause(400);
await page.keyboard.type('1-3, 5', { delay: 90 });
await pause(1000);
await page.keyboard.press('Escape'); // show, don't download
await page.waitForSelector('.range-input', { state: 'detached' });
await pause(400);
await caption('…or pick the pages that matter and keep just those');
await clickAt(cards().nth(0));
await page.keyboard.down('Shift');
await clickAt(cards().nth(2));
await page.keyboard.up('Shift');
await pause(500);
await clickAt(dockButton('Keep these'));
await waitCards(3);
await pause(1700);
await resetSession();

// 5) Working with images
await caption('Drop in photos — JPG and PNG become pages');
await dropPhotos();
await waitCards(3);
await page.waitForSelector('.card .page-canvas');
await pause(2000);
await caption('And any page can go back out as an image');
await clickAt(page.getByRole('button', { name: 'Export images…' }));
const imgDlg = page.getByRole('dialog', { name: 'Export pages as images' });
await imgDlg.waitFor();
await pause(800);
await clickAt(
  imgDlg.getByRole('group', { name: 'Format' }).getByRole('button', { name: 'JPG' }),
);
await pause(700);
await clickAt(
  imgDlg.getByRole('group', { name: 'Resolution' }).getByRole('button', { name: '3×' }),
);
await pause(700);
await caption('One file each — or a single .zip');
const zipBox = await imgDlg.locator('.zip-toggle').boundingBox();
await glide(zipBox.x + zipBox.width / 2, zipBox.y + zipBox.height / 2, 600);
await pause(1300);
await clickAt(imgDlg.getByRole('button', { name: 'Cancel' }));
await pause(400);
// No reset — the photos stay up for the privacy beat.

// 6) Keeping it to yourself
await caption('All of this happened on your device — nothing was uploaded');
await hoverSave(2200);
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

// Playwright writes a hash-named webm; give it a stable name next to v1/v2's.
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
const dest = join(videoDir, 'pdf-mana-promo-3.webm');
renameSync(src, dest);
rmSync(outDir, { recursive: true, force: true });
console.log(
  `promo video v3 written to release/video/pdf-mana-promo-3.webm (${statSync(dest).size} bytes)`,
);
