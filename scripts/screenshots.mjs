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

// Full-frame abstract illustration: a "PDF 1" stack of numbered pages plus a
// blue "PDF 2" stack combining into one merged document. No app capture —
// the whole 1280x800 frame is drawn in-page (bundled fonts, same gradient).
async function shootMergeAbstract(file, headline, sub) {
  await page.setViewportSize(FRAME);
  await page.evaluate(
    ([h, s]) => {
      const NUMS = { 1: '#0073d9', 2: '#009e47', 3: '#f28c00' };
      // A page card: a huge numeral, or receipt-style blue lines. Cards are
      // spread (small overlap, alternating tilt) so every page stays legible.
      const mini = (kind, deg, dx, dy, z, w = 128, hh = 166) => {
        const c = document.createElement('div');
        c.style.cssText =
          `position:absolute;width:${w}px;height:${hh}px;background:#fff;` +
          'border-radius:10px;box-shadow:0 10px 26px rgba(0,0,0,0.28);' +
          `left:${dx}px;top:${dy}px;transform:rotate(${deg}deg);z-index:${z};` +
          'display:flex;align-items:center;justify-content:center;overflow:hidden;';
        if (kind === 'lines') {
          c.style.background = '#eaf2fd';
          const inner = document.createElement('div');
          inner.style.cssText = 'width:100%;height:100%;padding:12px 14px;';
          const band = document.createElement('div');
          band.style.cssText =
            'height:22px;background:#c3d9f5;border-radius:5px;margin-bottom:11px;';
          inner.append(band);
          for (let i = 0; i < 6; i += 1) {
            const line = document.createElement('div');
            line.style.cssText =
              `height:8px;border-radius:4px;background:#bcd3ef;margin-bottom:9px;` +
              `width:${88 - ((i * 17) % 34)}%;`;
            inner.append(line);
          }
          c.append(inner);
        } else {
          const n = document.createElement('div');
          n.style.cssText =
            "font:700 96px/1 Fredoka, Nunito, 'Helvetica Neue', sans-serif;" +
            `color:${NUMS[kind]};`;
          n.textContent = kind;
          c.append(n);
        }
        return c;
      };
      const stack = (cards, label, w) => {
        const wrap = document.createElement('div');
        wrap.style.cssText =
          'display:flex;flex-direction:column;align-items:center;gap:0;';
        const board = document.createElement('div');
        board.style.cssText = `position:relative;width:${w}px;height:240px;`;
        cards.forEach((make) => board.append(make));
        const cap = document.createElement('div');
        cap.style.cssText =
          "font:700 24px/1 Fredoka, Nunito, 'Helvetica Neue', sans-serif;" +
          'color:#fff;margin-top:22px;opacity:0.95;';
        cap.textContent = label;
        wrap.append(board, cap);
        return wrap;
      };
      const glyph = (t) => {
        const g = document.createElement('div');
        g.style.cssText =
          "font:700 84px/1 Fredoka, Nunito, 'Helvetica Neue', sans-serif;" +
          'color:#fff;margin-bottom:64px;text-shadow:0 4px 14px rgba(0,0,0,0.2);';
        g.textContent = t;
        return g;
      };
      // The merged result: one big document (folded corner, echo pages behind)
      // whose face shows all five source pages inside.
      const mergedDoc = () => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;';
        const board = document.createElement('div');
        board.style.cssText = 'position:relative;width:260px;height:240px;';
        for (const [deg, dx, dy, z] of [
          [-6, 8, 18, 1],
          [-3, 16, 10, 2],
        ]) {
          const echo = document.createElement('div');
          echo.style.cssText =
            'position:absolute;width:210px;height:216px;background:rgba(255,255,255,0.55);' +
            `border-radius:12px;left:${dx}px;top:${dy}px;transform:rotate(${deg}deg);` +
            `z-index:${z};box-shadow:0 10px 26px rgba(0,0,0,0.18);`;
          board.append(echo);
        }
        const doc = document.createElement('div');
        doc.style.cssText =
          'position:absolute;width:210px;height:216px;background:#fff;' +
          'border-radius:12px;left:28px;top:4px;z-index:3;' +
          'box-shadow:0 14px 34px rgba(0,0,0,0.3);padding:16px 14px;' +
          'display:grid;grid-template-columns:repeat(3,1fr);gap:10px;align-content:start;';
        const tiny = (kind) => {
          const t = document.createElement('div');
          t.style.cssText =
            'height:84px;border-radius:6px;border:2px solid #eceaf3;background:#fff;' +
            'display:flex;align-items:center;justify-content:center;overflow:hidden;';
          if (kind === 'lines') {
            t.style.background = '#eaf2fd';
            t.style.borderColor = '#d7e6fa';
            const inner = document.createElement('div');
            inner.style.cssText = 'width:100%;height:100%;padding:7px 8px;';
            const band = document.createElement('div');
            band.style.cssText =
              'height:9px;background:#c3d9f5;border-radius:3px;margin-bottom:6px;';
            inner.append(band);
            for (let i = 0; i < 4; i += 1) {
              const line = document.createElement('div');
              line.style.cssText =
                `height:5px;border-radius:2px;background:#bcd3ef;margin-bottom:5px;` +
                `width:${86 - ((i * 19) % 30)}%;`;
              inner.append(line);
            }
            t.append(inner);
          } else {
            const n = document.createElement('div');
            n.style.cssText =
              "font:700 46px/1 Fredoka, Nunito, 'Helvetica Neue', sans-serif;" +
              `color:${NUMS[kind]};`;
            n.textContent = kind;
            t.append(n);
          }
          return t;
        };
        [1, 2, 3, 'lines', 'lines'].forEach((k) => doc.append(tiny(k)));
        const cap = document.createElement('div');
        cap.style.cssText =
          "font:700 24px/1 Fredoka, Nunito, 'Helvetica Neue', sans-serif;" +
          'color:#fff;margin-top:22px;opacity:0.95;';
        cap.textContent = 'One tidy PDF';
        board.append(doc);
        wrap.append(board, cap);
        return wrap;
      };

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

      const row = document.createElement('div');
      row.style.cssText =
        'flex:1;display:flex;align-items:center;justify-content:center;gap:56px;' +
        'padding-bottom:36px;';
      row.append(
        stack(
          [mini(1, -6, 0, 26, 1), mini(2, 0, 108, 14, 2), mini(3, 6, 216, 26, 3)],
          'PDF 1',
          344,
        ),
        glyph('+'),
        stack([mini('lines', -5, 0, 24, 1), mini('lines', 5, 104, 16, 2)], 'PDF 2', 232),
        glyph('='),
        mergedDoc(),
      );
      frame.append(head, tag, row);
      document.body.append(frame);
    },
    [headline, sub],
  );
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.waitForTimeout(200);
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

// 3) Merge — an abstract "PDF 1 + PDF 2 → one PDF" composition instead of a
// grid capture (a merged grid just looks like a grid). Drawn in-page so the
// bundled Fredoka/Nunito fonts apply, captured at the full frame size.
await shootMergeAbstract(
  '03-merge.png',
  'Combine PDFs in seconds',
  'Drop files together — pages append, ready to arrange · Nothing is uploaded',
);

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
