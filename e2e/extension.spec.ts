import { test, expect, type BrowserContext } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { readFileSync } from 'node:fs';
import {
  launchExtension,
  openEditor as openEditorPage,
  makePdf,
  imagePdf,
  iconPng,
  drop,
  pdf,
  widths,
  cropBox,
  makeJpeg,
} from './helpers';

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  ({ context, extensionId } = await launchExtension());
});

test.afterAll(async () => {
  await context?.close();
});

const openEditor = () => openEditorPage(context, extensionId);

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

test('switching the Look re-themes the app and survives a reload', async () => {
  const page = await openEditor();
  await drop(page, [pdf('t.pdf', await makePdf([[200, 200]]))]);
  await page.locator('.look-trigger').click();
  await page.locator('.look-option', { hasText: 'Sticker' }).click();
  await expect(page.locator('.app')).toHaveAttribute('data-look', 'sticker');

  // The look is remembered on a fresh load, without clicking Restore.
  await page.reload();
  await expect(page.locator('.app')).toHaveAttribute('data-look', 'sticker');

  // Tidy up so the saved preference doesn't leak into other tests.
  await page.evaluate(() => localStorage.clear());
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

test('crop: drag a box, apply to all, then Clear crop restores full size', async () => {
  const page = await openEditor();
  await drop(page, [pdf('c.pdf', await makePdf([[400, 600]]))]);
  await expect(page.locator('.card')).toHaveCount(1);

  // Open Crop from the toolbar (no selection needed — it uses the first page).
  await page.locator('.toolbar').getByRole('button', { name: 'Crop' }).click();
  await expect(page.locator('.crop-canvas')).toBeVisible({ timeout: 15_000 });

  // Drag a wide box (~70% × ~30%) so the cropped region is landscape — the
  // opposite orientation of the 400×600 page, which the WYSIWYG frame must show.
  const stage = (await page.locator('.crop-stage').boundingBox())!;
  await page.mouse.move(stage.x + stage.width * 0.15, stage.y + stage.height * 0.15);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width * 0.5, stage.y + stage.height * 0.3, {
    steps: 5,
  });
  await page.mouse.move(stage.x + stage.width * 0.85, stage.y + stage.height * 0.45, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(page.locator('.crop-rect')).toBeVisible();

  await page.getByRole('button', { name: 'Apply to all' }).click();
  await expect(page.locator('.toolbar').getByText('Clear crop')).toBeVisible();

  // The card goes WYSIWYG: a crop badge appears and the visible page frame
  // takes the crop region's landscape aspect instead of the page's 400:600.
  // Crop ≈ 0.7w × 0.3h of a 400×600 page → 280×180 → aspect ≈ 1.56.
  await expect(page.locator('.card-crop-badge')).toHaveCount(1);
  const frame = (await page.locator('.card-frame').boundingBox())!;
  expect(frame.width / frame.height).toBeGreaterThan(1.3);
  expect(frame.width / frame.height).toBeLessThan(1.8);

  // The exported CropBox is meaningfully smaller than the 400×600 MediaBox.
  let dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  const cropped = await cropBox(await dl);
  expect(cropped.w).toBeLessThan(360);
  expect(cropped.h).toBeLessThan(540);

  // Clear crop puts the full page back: badge gone, frame back to 400:600.
  await page.locator('.toolbar').getByRole('button', { name: 'Clear crop' }).click();
  await expect(page.locator('.card-crop-badge')).toHaveCount(0);
  const full = (await page.locator('.card-frame').boundingBox())!;
  expect(full.width / full.height).toBeGreaterThan(0.6);
  expect(full.width / full.height).toBeLessThan(0.72);
  dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  expect(await cropBox(await dl)).toEqual({ w: 400, h: 600 });
});

test('crop: dragging a corner handle resizes the box with the opposite corner pinned', async () => {
  const page = await openEditor();
  await drop(page, [pdf('cr.pdf', await makePdf([[400, 600]]))]);
  await expect(page.locator('.card')).toHaveCount(1);

  await page.locator('.toolbar').getByRole('button', { name: 'Crop' }).click();
  await expect(page.locator('.crop-canvas')).toBeVisible({ timeout: 15_000 });

  // Draw an initial box across the middle of the page.
  const stage = (await page.locator('.crop-stage').boundingBox())!;
  await page.mouse.move(stage.x + stage.width * 0.25, stage.y + stage.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width * 0.55, stage.y + stage.height * 0.55, {
    steps: 5,
  });
  await page.mouse.up();
  const before = (await page.locator('.crop-rect').boundingBox())!;

  // Grab the bottom-right handle and drag it further out; the top-left stays pinned.
  const br = (await page.locator('.crop-handle.br').boundingBox())!;
  await page.mouse.move(br.x + br.width / 2, br.y + br.height / 2);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width * 0.8, stage.y + stage.height * 0.8, {
    steps: 5,
  });
  await page.mouse.up();
  const after = (await page.locator('.crop-rect').boundingBox())!;

  // Opposite (top-left) corner is anchored (a restart would shift it tens of px);
  // the box grew rather than starting over.
  expect(Math.abs(after.x - before.x)).toBeLessThan(8);
  expect(Math.abs(after.y - before.y)).toBeLessThan(8);
  expect(after.width).toBeGreaterThan(before.width + 10);
  expect(after.height).toBeGreaterThan(before.height + 10);

  // The resized box exports a crop smaller than the full 400×600 page.
  await page.getByRole('button', { name: 'Apply to all' }).click();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  const cropped = await cropBox(await dl);
  expect(cropped.w).toBeLessThan(400);
  expect(cropped.h).toBeLessThan(600);
});

test('manual Split (toolbar) marks a boundary and exports one file per part', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      'ms.pdf',
      await makePdf([
        [100, 100],
        [200, 200],
        [300, 300],
        [400, 400],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(4);

  // Split *after* page 2 → parts [1,2] and [3,4].
  await page.locator('.card').nth(1).click();
  await page
    .locator('.toolbar')
    .getByRole('button', { name: 'Split', exact: true })
    .click();
  await expect(page.locator('.card-split-badge')).toHaveCount(1);

  const downloads: Download[] = [];
  page.on('download', (d) => downloads.push(d));
  await page.getByRole('button', { name: 'Save PDF' }).click();
  await expect.poll(() => downloads.length, { timeout: 10_000 }).toBe(2);
  expect(
    (await PDFDocument.load(readFileSync(await downloads[0].path()))).getPageCount(),
  ).toBe(2);
  expect(
    (await PDFDocument.load(readFileSync(await downloads[1].path()))).getPageCount(),
  ).toBe(2);
});

test('rotation accumulates: two turns → 180°, four → back to 0°', async () => {
  const page = await openEditor();
  await drop(page, [pdf('rot.pdf', await makePdf([[300, 500]]))]);
  await expect(page.locator('.card')).toHaveCount(1);

  const rotate = page.locator('.toolbar').getByRole('button', { name: 'Rotate' });
  await page.locator('.card').nth(0).click();
  await rotate.click();
  await rotate.click();

  let dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  expect(
    (await PDFDocument.load(readFileSync(await (await dl).path())))
      .getPage(0)
      .getRotation().angle,
  ).toBe(180);

  // Two more turns wrap back to 0 rather than 360.
  await rotate.click();
  await rotate.click();
  dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  expect(
    (await PDFDocument.load(readFileSync(await (await dl).path())))
      .getPage(0)
      .getRotation().angle,
  ).toBe(0);
});

test('Add PDF via the file picker appends to the current session', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      'first.pdf',
      await makePdf([
        [150, 1],
        [160, 1],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(2);

  // The toolbar's hidden <input type=file> — the picker path, not drag-drop.
  const more = await makePdf([
    [250, 1],
    [260, 1],
    [270, 1],
  ]);
  await page.locator('.toolbar input[type="file"]').setInputFiles({
    name: 'second.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(more),
  });
  await expect(page.locator('.card')).toHaveCount(5);

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  expect(await widths(await dl)).toEqual([150, 160, 250, 260, 270]);
});

test('Images → PDF: dropping a JPEG adds a page', async () => {
  const page = await openEditor();
  await drop(page, [
    { name: 'pic.jpg', bytes: await makeJpeg(page), type: 'image/jpeg' },
  ]);
  await expect(page.locator('.card')).toHaveCount(1);

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  expect(
    (await PDFDocument.load(readFileSync(await (await dl).path()))).getPageCount(),
  ).toBe(1);
});

test('PDF → Images: JPG format at 2× exports one .jpg per page', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      'j.pdf',
      await makePdf([
        [200, 200],
        [200, 200],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(2);

  await page.getByRole('button', { name: 'Export images…' }).click();
  await page.getByRole('button', { name: 'JPG' }).click();
  await page.getByRole('button', { name: '2×' }).click(); // non-default scale
  await page.locator('.zip-toggle input').uncheck();
  const downloads: Download[] = [];
  page.on('download', (d) => downloads.push(d));
  await page.getByRole('button', { name: /Export \d+ image/ }).click();
  await expect.poll(() => downloads.length, { timeout: 10_000 }).toBe(2);
  expect(downloads[0].suggestedFilename()).toMatch(/\.jpg$/);
});

test('Mix double-sided preset reverses the second document by default', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      'fronts.pdf',
      await makePdf([
        [100, 100],
        [101, 101],
      ]),
    ),
    pdf(
      'backs.pdf',
      await makePdf([
        [200, 200],
        [201, 201],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(4);

  await page.locator('.toolbar').getByRole('button', { name: 'Mix' }).click();
  // The 2nd doc's "Reverse" is checked out of the box — leave it as-is.
  await expect(page.locator('.mix-row').nth(1).getByRole('checkbox')).toBeChecked();
  await page.getByRole('button', { name: 'Mix pages' }).click();

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  // Fronts straight (100,101) interleaved with backs reversed (201,200).
  expect(await widths(await dl)).toEqual([100, 201, 101, 200]);
});

test('selection: Shift-click picks a range; Select all picks everything', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      'sel.pdf',
      await makePdf([
        [100, 1],
        [200, 1],
        [300, 1],
        [400, 1],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(4);

  await page.locator('.card').nth(0).click();
  await page
    .locator('.card')
    .nth(2)
    .click({ modifiers: ['Shift'] });
  await expect(page.locator('.card.selected')).toHaveCount(3);

  await page.locator('.toolbar').getByRole('button', { name: 'Select all' }).click();
  await expect(page.locator('.card.selected')).toHaveCount(4);
});

test('undo and redo toolbar buttons step through a delete', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      'ur.pdf',
      await makePdf([
        [100, 1],
        [200, 1],
        [300, 1],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(3);

  await page.locator('.card').nth(1).click();
  await page.locator('.toolbar').getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.card')).toHaveCount(2);

  await page.locator('button[title^="Undo"]').click();
  await expect(page.locator('.card')).toHaveCount(3);

  await page.locator('button[title^="Redo"]').click();
  await expect(page.locator('.card')).toHaveCount(2);
});

test('errors: a corrupt PDF shows an error toast', async () => {
  const page = await openEditor();
  await drop(page, [pdf('broken.pdf', [1, 2, 3, 4, 5])]);
  const toast = page.locator('.toast.error');
  await expect(toast).toBeVisible({ timeout: 15_000 });
  await expect(toast).toContainText('Could not add');

  // This page ends in the editor with 0 pages, so its debounced autosave fires a
  // clearSession() on a timer. Close it so that can't wipe a later test's session.
  await page.close();
});

test('errors: an unsupported file type is ignored, not loaded', async () => {
  const page = await openEditor();
  await drop(page, [{ name: 'note.txt', bytes: [104, 105], type: 'text/plain' }]);
  // Nothing is ingested — we stay on the empty state with no cards.
  await expect(page.getByText("Let's fix up your PDF!")).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(0);
});

test('persistence: Discard dismisses the offer and clears the session', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      'discard.pdf',
      await makePdf([
        [100, 1],
        [200, 1],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(2);

  await page.waitForTimeout(1200); // let the debounced autosave flush
  await page.reload();

  const banner = page.locator('.restore-banner');
  await expect(banner).toBeVisible({ timeout: 5_000 });
  await banner.getByRole('button', { name: 'Discard' }).click();
  await expect(banner).toHaveCount(0);
  await expect(page.getByText("Let's fix up your PDF!")).toBeVisible();

  // Discard cleared the saved session, so a fresh reload offers nothing.
  await page.reload();
  await expect(page.getByText("Let's fix up your PDF!")).toBeVisible();
  await expect(page.locator('.restore-banner')).toHaveCount(0);

  // Belt-and-suspenders cleanup in case the assertion above ever regresses.
  await page.evaluate(
    () =>
      new Promise<void>((res) => {
        const r = indexedDB.deleteDatabase('pdf-mana');
        r.onsuccess = r.onerror = r.onblocked = () => res();
      }),
  );
});

test('duplicate: dock button and Cmd/Ctrl+D copy the picked pages', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      'dup.pdf',
      await makePdf([
        [100, 1],
        [200, 1],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(2);

  await page.locator('.card').nth(0).click();
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.locator('.card')).toHaveCount(3);

  // The copy is selected — rotate it via the dock to prove the copy is
  // independent of its original in the export.
  await page.locator('.dock').getByRole('button', { name: 'Rotate' }).click();

  // Cmd/Ctrl+D duplicates the (still selected) copy; undo removes it again.
  await page.keyboard.press('ControlOrMeta+d');
  await expect(page.locator('.card')).toHaveCount(4);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('.card')).toHaveCount(3);

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  const out = await PDFDocument.load(readFileSync(await (await dl).path()));
  expect(out.getPages().map((p) => Math.round(p.getWidth()))).toEqual([100, 100, 200]);
  expect(out.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90, 0]);
});

test('reverse: flips all pages, or just the picked ones', async () => {
  const page = await openEditor();
  await drop(page, [
    pdf(
      'rev.pdf',
      await makePdf([
        [100, 1],
        [200, 1],
        [300, 1],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(3);

  // No selection → the whole document reverses.
  await page.getByRole('button', { name: 'Reverse page order' }).click();
  const dl1 = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  expect(await widths(await dl1)).toEqual([300, 200, 100]);

  // Pick the first two pages (300, 200) → only they swap.
  await page.locator('.card').nth(0).click();
  await page
    .locator('.card')
    .nth(1)
    .click({ modifiers: ['ControlOrMeta'] });
  await page.getByRole('button', { name: 'Reverse picked pages' }).click();
  const dl2 = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  expect(await widths(await dl2)).toEqual([200, 300, 100]);
});

test('Un-mix pulls an interleaved document apart into two files', async () => {
  const page = await openEditor();
  // One interleaved doc: front, back, front, back.
  await drop(page, [
    pdf(
      'inter.pdf',
      await makePdf([
        [100, 1],
        [200, 1],
        [101, 1],
        [201, 1],
      ]),
    ),
  ]);
  await expect(page.locator('.card')).toHaveCount(4);

  // Mix is enabled for a single doc now, and the dialog opens in Un-mix mode.
  await page.locator('.toolbar').getByRole('button', { name: 'Mix' }).click();
  await expect(page.getByRole('button', { name: 'Un-mix pages' })).toBeVisible();
  // "Split into two files" is on by default — apply as-is.
  await page.getByRole('button', { name: 'Un-mix pages' }).click();

  const downloads: Download[] = [];
  page.on('download', (d) => downloads.push(d));
  await page.getByRole('button', { name: 'Save PDF' }).click();
  await expect.poll(() => downloads.length, { timeout: 10_000 }).toBe(2);
  expect(await widths(downloads[0])).toEqual([100, 101]); // fronts
  expect(await widths(downloads[1])).toEqual([200, 201]); // backs
});

test('insert blank: follows a rotated neighbor page orientation', async () => {
  const page = await openEditor();
  await drop(page, [pdf('rotblank.pdf', await makePdf([[300, 500]]))]);
  await expect(page.locator('.card')).toHaveCount(1);

  // Rotate the page to landscape, then insert a blank after it — the blank
  // should match the page as displayed (500×300), not its stored size.
  await page.locator('.card').first().getByRole('button', { name: 'Rotate' }).click();
  await page.locator('.card').nth(0).click();
  await page.getByRole('button', { name: 'Blank page' }).click();
  await expect(page.locator('.card')).toHaveCount(2);

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  const out = await PDFDocument.load(readFileSync(await (await dl).path()));
  expect(Math.round(out.getPage(1).getWidth())).toBe(500);
  expect(Math.round(out.getPage(1).getHeight())).toBe(300);
});

test('insert blank: matches the neighbor page size and survives a reload', async () => {
  const page = await openEditor();
  await drop(page, [pdf('blank.pdf', await makePdf([[300, 500]]))]);
  await expect(page.locator('.card')).toHaveCount(1);

  await page.locator('.card').nth(0).click();
  await page.getByRole('button', { name: 'Blank page' }).click();
  await expect(page.locator('.card')).toHaveCount(2);

  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  const out = await PDFDocument.load(readFileSync(await (await dl).path()));
  expect(out.getPageCount()).toBe(2);
  expect(Math.round(out.getPage(1).getWidth())).toBe(300);
  expect(Math.round(out.getPage(1).getHeight())).toBe(500);

  // The synthetic blank doc must round-trip through autosave/restore.
  await page.waitForTimeout(1200);
  await page.reload();
  const banner = page.locator('.restore-banner');
  await expect(banner).toBeVisible({ timeout: 5_000 });
  await banner.getByRole('button', { name: 'Restore' }).click();
  await expect(page.locator('.card')).toHaveCount(2);

  const dl2 = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save PDF' }).click();
  expect(await widths(await dl2)).toEqual([300, 300]);

  // Tidy up so the saved session doesn't leak into other runs.
  await page.evaluate(
    () =>
      new Promise<void>((res) => {
        const r = indexedDB.deleteDatabase('pdf-mana');
        r.onsuccess = r.onerror = r.onblocked = () => res();
      }),
  );
});
