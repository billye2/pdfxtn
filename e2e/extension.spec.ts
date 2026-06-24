import {
  test,
  expect,
  chromium,
  type BrowserContext,
  type Page,
  type Download,
} from '@playwright/test';
import { PDFDocument, degrees } from 'pdf-lib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const distPath = join(here, '..', 'dist');
const iconPng = readFileSync('src/icons/icon128.png');

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--headless=new',
      '--no-sandbox',
      `--disable-extensions-except=${distPath}`,
      `--load-extension=${distPath}`,
    ],
  });
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

// ---- helpers ----------------------------------------------------------------

async function makePdf(sizes: Array<[number, number]>, rotate = 0): Promise<number[]> {
  const doc = await PDFDocument.create();
  for (const [w, h] of sizes) {
    const p = doc.addPage([w, h]);
    if (rotate) p.setRotation(degrees(rotate));
  }
  return [...(await doc.save())];
}

async function imagePdf(n: number): Promise<number[]> {
  const doc = await PDFDocument.create();
  const img = await doc.embedPng(iconPng);
  for (let i = 0; i < n; i += 1) {
    const p = doc.addPage([300, 300]);
    p.drawImage(img, { x: 20, y: 20, width: 200, height: 200 });
  }
  return [...(await doc.save())];
}

async function openEditor(): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/editor/index.html`);
  await expect(page.getByText("Let's fix up your PDF!")).toBeVisible();
  return page;
}

async function drop(
  page: Page,
  files: Array<{ name: string; bytes: number[]; type: string }>,
) {
  const dt = await page.evaluateHandle((fs) => {
    const d = new DataTransfer();
    for (const f of fs)
      d.items.add(new File([new Uint8Array(f.bytes)], f.name, { type: f.type }));
    return d;
  }, files);
  await page.dispatchEvent('.app', 'dragover', { dataTransfer: dt });
  await page.dispatchEvent('.app', 'drop', { dataTransfer: dt });
}

const pdf = (name: string, bytes: number[]) => ({ name, bytes, type: 'application/pdf' });

async function widths(d: Download): Promise<number[]> {
  const out = await PDFDocument.load(readFileSync(await d.path()));
  return out.getPages().map((p) => Math.round(p.getWidth()));
}

// ---- tests ------------------------------------------------------------------

test('load, render thumbnails, original labels, delete, export', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      's.pdf',
      await makePdf([
        [300, 400],
        [400, 300],
        [350, 500],
      ]),
    ),
  ]);

  await expect(page.locator('.card')).toHaveCount(3);
  await expect(page.locator('.card-label').nth(0)).toHaveText('Page 1');
  await expect(page.locator('.card .page-canvas').first()).toBeVisible({
    timeout: 15_000,
  });

  await page.locator('.card').nth(1).click();
  await page.keyboard.press('Delete');
  await expect(page.locator('.card')).toHaveCount(2);
  await expect(page.locator('.card-label').nth(1)).toHaveText('Page 3');

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  expect(await widths(await dl)).toEqual([300, 350]);
});

test('merging two image-heavy PDFs keeps the exported size sane', async () => {
  const page = await openEditor();
  const a = await imagePdf(6);
  const b = await imagePdf(6);
  await drop(page, [pdf('a.pdf', a), pdf('b.pdf', b)]);
  await expect(page.locator('.card')).toHaveCount(12);

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  const out = readFileSync(await (await dl).path());
  expect((await PDFDocument.load(out)).getPageCount()).toBe(12);
  expect(out.length).toBeLessThan((a.length + b.length) * 2); // not Nx
});

test('rotate a page (clockwise) reflects in the export', async () => {
  const page = await openEditor();
  await drop(page, [pdf('r.pdf', await makePdf([[300, 500]]))]);
  await expect(page.locator('.card')).toHaveCount(1);

  await page.locator('.card').first().getByRole('button', { name: 'Rotate' }).click();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  const out = await PDFDocument.load(readFileSync(await (await dl).path()));
  expect(out.getPage(0).getRotation().angle).toBe(90);
});

// Skipped: dnd-kit's PointerSensor doesn't engage with synthetic Playwright
// pointer events (the page hangs mid-drag). Reorder is covered by unit tests
// (pageModel `reorder`) and verified manually in the browser.
test.skip('drag to reorder changes page order', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      'o.pdf',
      await makePdf([
        [100, 100],
        [200, 200],
        [300, 300],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(3);

  // Drag card 0 onto card 2's position. dnd-kit's PointerSensor needs the move
  // to exceed the activation distance and then settle over the target — do it in
  // small timed steps so the sensor engages reliably under automation.
  const src = (await page.locator('.card').nth(0).boundingBox())!;
  const dst = (await page.locator('.card').nth(2).boundingBox())!;
  const sx = src.x + src.width / 2;
  const sy = src.y + src.height / 2;
  const dx = dst.x + dst.width / 2;
  const dy = dst.y + dst.height / 2;

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.move(sx + 10, sy + 10); // exceed 6px activation
  await page.waitForTimeout(60);
  for (let i = 1; i <= 20; i += 1) {
    await page.mouse.move(sx + ((dx - sx) * i) / 20, sy + ((dy - sy) * i) / 20);
    await page.waitForTimeout(15);
  }
  await page.waitForTimeout(120); // let the sortable settle on the target
  await page.mouse.up();
  await expect(page.locator('.card-label').nth(2)).toHaveText('Page 1');

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  expect(await widths(await dl)).toEqual([200, 300, 100]);
});

test('extract ("Keep these") keeps only selected pages', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      'e.pdf',
      await makePdf([
        [100, 100],
        [200, 200],
        [300, 300],
        [400, 400],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(4);

  await page.locator('.card').nth(0).click();
  await page
    .locator('.card')
    .nth(2)
    .click({ modifiers: ['ControlOrMeta'] });
  await page.getByRole('button', { name: 'Keep these' }).click();
  await expect(page.locator('.card')).toHaveCount(2);

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  expect(await widths(await dl)).toEqual([100, 300]);
});

test('Mix interleaves two documents', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      'A.pdf',
      await makePdf([
        [100, 100],
        [101, 101],
      ]),
    ),
    pdf(
      'B.pdf',
      await makePdf([
        [200, 200],
        [201, 201],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(4);

  await page.locator('.toolbar').getByRole('button', { name: 'Mix' }).click();
  // Straight interleave: uncheck the default "reverse 2nd doc".
  await page.locator('.mix-row').nth(1).getByRole('checkbox').uncheck();
  await page.getByRole('button', { name: 'Mix pages' }).click();

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  expect(await widths(await dl)).toEqual([100, 200, 101, 201]);
});

test('Split every N produces one file per chunk', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      'sp.pdf',
      await makePdf([
        [100, 100],
        [200, 200],
        [300, 300],
        [400, 400],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(4);

  await page.getByRole('button', { name: 'Split every…' }).click();
  await page.locator('.split-n').fill('2');
  await page.getByRole('button', { name: 'Apply split marks' }).click();

  const downloads: Download[] = [];
  page.on('download', (d) => downloads.push(d));
  await page.getByRole('button', { name: 'Save PDF' }).click();
  await expect.poll(() => downloads.length, { timeout: 10_000 }).toBe(2);
  expect(
    (await PDFDocument.load(readFileSync(await downloads[0].path()))).getPageCount(),
  ).toBe(2);
});

test('Export by position (range) exports the chosen pages', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      'rg.pdf',
      await makePdf([
        [110, 1],
        [120, 1],
        [130, 1],
        [140, 1],
        [150, 1],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(5);

  await page.getByRole('button', { name: 'Export range…' }).click();
  await page.locator('.range-input').fill('1, 3, 5');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export these pages' }).click();
  expect(await widths(await dl)).toEqual([110, 130, 150]);
});

test('Images → PDF: dropping a PNG adds a page', async () => {
  const page = await openEditor();
  await drop(page, [{ name: 'pic.png', bytes: [...iconPng], type: 'image/png' }]);
  await expect(page.locator('.card')).toHaveCount(1);

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  expect(
    (await PDFDocument.load(readFileSync(await (await dl).path()))).getPageCount(),
  ).toBe(1);
});

test('PDF → Images exports one image per page', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      'im.pdf',
      await makePdf([
        [200, 200],
        [200, 200],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(2);

  await page.getByRole('button', { name: 'Export images…' }).click();
  await page.getByRole('button', { name: 'PNG' }).click();
  await page.getByRole('button', { name: '1×' }).click();
  await page.locator('.zip-toggle input').uncheck(); // test the per-file path
  const downloads: Download[] = [];
  page.on('download', (d) => downloads.push(d));
  await page.getByRole('button', { name: /Export \d+ image/ }).click();
  await expect.poll(() => downloads.length, { timeout: 10_000 }).toBe(2);
  expect(downloads[0].suggestedFilename()).toMatch(/\.png$/);
});

test('PDF → Images can bundle pages into a single .zip', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      'z.pdf',
      await makePdf([
        [200, 200],
        [200, 200],
        [200, 200],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(3);

  await page.getByRole('button', { name: 'Export images…' }).click();
  await page.getByRole('button', { name: '1×' }).click();
  // The zip toggle defaults on for multi-page exports → one .zip download.
  await expect(page.locator('.zip-toggle input')).toBeChecked();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export \d+ image/ }).click();
  expect((await dl).suggestedFilename()).toMatch(/-images\.zip$/);
});

test('Lightbox preview opens, pages, and closes', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      'lb.pdf',
      await makePdf([
        [200, 300],
        [300, 200],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(2);

  await page.locator('.card').nth(0).dblclick();
  await expect(page.locator('.lightbox-canvas')).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.lightbox-pos')).toHaveText(/2 of 2/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.lightbox-backdrop')).toHaveCount(0);
});

test('switching the Look re-themes the app', async () => {
  const page = await openEditor();
  await drop(page, [pdf('t.pdf', await makePdf([[200, 200]]))]);
  await page.locator('.look-trigger').click();
  await page.locator('.look-option', { hasText: 'Sticker' }).click();
  await expect(page.locator('.app')).toHaveAttribute('data-look', 'sticker');
});

const META = process.platform === 'darwin' ? 'Meta' : 'Control';

test('keyboard: arrow keys nudge the selected page, undo reverts', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      'k.pdf',
      await makePdf([
        [100, 1],
        [200, 1],
        [300, 1],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(3);

  // Select page 1 and nudge it right one slot.
  await page.locator('.card').nth(0).click();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.card-label').nth(0)).toHaveText('Page 2');
  await expect(page.locator('.card-label').nth(1)).toHaveText('Page 1');

  // The reorder is undoable.
  await page.keyboard.press(`${META}+z`);
  await expect(page.locator('.card-label').nth(0)).toHaveText('Page 1');

  // Re-do the move and confirm it reflects in the export order.
  await page.keyboard.press('ArrowRight');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  expect(await widths(await dl)).toEqual([200, 100, 300]);
});

test('keyboard: Space toggles the preview open and closed', async () => {
  const page = await openEditor();
  await drop(page, [pdf('s2.pdf', await makePdf([[200, 300]]))]);
  await expect(page.locator('.card')).toHaveCount(1);

  await page.locator('.card').nth(0).click();
  await page.keyboard.press('Space');
  await expect(page.locator('.lightbox-canvas')).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('Space'); // toggles closed
  await expect(page.locator('.lightbox-backdrop')).toHaveCount(0);
  await page.keyboard.press('Space'); // open again
  await expect(page.locator('.lightbox-backdrop')).toHaveCount(1);
  await page.keyboard.press('Escape'); // Esc still closes
  await expect(page.locator('.lightbox-backdrop')).toHaveCount(0);
});

test('persistence: a reload offers to restore the session', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      'persist.pdf',
      await makePdf([
        [100, 1],
        [200, 1],
        [300, 1],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(3);

  // Let the debounced autosave flush, then reload as if the tab had crashed.
  await page.waitForTimeout(1200);
  await page.reload();

  const banner = page.locator('.restore-banner');
  await expect(banner).toBeVisible({ timeout: 5_000 });
  await expect(banner).toContainText('3 pages');
  await banner.getByRole('button', { name: 'Restore' }).click();
  await expect(page.locator('.card')).toHaveCount(3);
  await expect(page.locator('.card-label').nth(0)).toHaveText('Page 1');

  // The restored pages still export correctly.
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  expect(await widths(await dl)).toEqual([100, 200, 300]);

  // Tidy up so the saved session doesn't leak into other runs.
  await page.evaluate(
    () =>
      new Promise<void>((res) => {
        const r = indexedDB.deleteDatabase('pdf-mana');
        r.onsuccess = r.onerror = r.onblocked = () => res();
      }),
  );
});
