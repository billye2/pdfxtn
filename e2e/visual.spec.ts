// Theme-matrix visual regression: for every Look, screenshot the surfaces
// where theming bugs have actually shipped (grid + dock + open look menu,
// crop dialog, lightbox). Baselines are generated on the developer's macOS
// (`npm run visual:update`) and committed under e2e/__screenshots__/ — this
// project never runs in CI, where Linux font rendering would never match.
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { LOOK_ORDER, LOOKS } from '../src/editor/themes';
import { launchExtension, openEditor, drop, pdf, samplePdf } from './helpers';

test.skip(!!process.env.CI, 'visual baselines are macOS-only; run npm run visual locally');

let context: BrowserContext;
let extensionId: string;
let page: Page;

const META = process.platform === 'darwin' ? 'Meta' : 'Control';

test.beforeAll(async () => {
  ({ context, extensionId } = await launchExtension());
  page = await openEditor(context, extensionId);
  await page.setViewportSize({ width: 1280, height: 800 });

  // Deterministic content: 6 realistic sample pages, all rendered before any
  // shot; select three so the dock is up (selection survives look switches).
  await drop(page, [pdf('sample.pdf', await samplePdf())]);
  await expect(page.locator('.card .page-canvas')).toHaveCount(6, { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
  // The "Added 6 pages" toast auto-dismisses after ~3.5s — wait it out so it
  // can't photobomb a shot.
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 10_000 });
});

// The lightbox step's dblclick collapses the selection to one card, so every
// look re-normalizes to the same three picks before its shots.
async function selectThree() {
  await page.locator('.card').nth(0).click();
  await page.locator('.card').nth(2).click({ modifiers: [META] });
  await page.locator('.card').nth(4).click({ modifiers: [META] });
  await expect(page.locator('.dock-count')).toHaveText('3');
}

test.afterAll(async () => {
  await page?.evaluate(() => {
    localStorage.clear();
    indexedDB.deleteDatabase('pdf-mana');
  });
  await context?.close();
});

for (const look of LOOK_ORDER) {
  test(`visual: ${look}`, async () => {
    await test.step('switch look', async () => {
      await page.locator('.look-trigger').click();
      await page.locator('.look-option', { hasText: LOOKS[look].name }).click();
      await expect(page.locator('.app')).toHaveAttribute('data-look', look);
      await selectThree();
    });

    await test.step('grid + dock + look menu', async () => {
      await page.locator('.look-trigger').click();
      await expect(page.locator('.look-menu')).toBeVisible();
      await page.mouse.move(0, 0); // park the cursor so hover styles are stable
      await expect(page).toHaveScreenshot(`grid-dock-menu-${look}.png`);
      await page.locator('.look-backdrop').click();
      await expect(page.locator('.look-menu')).toHaveCount(0);
    });

    await test.step('crop dialog', async () => {
      await page
        .locator('.toolbar')
        .getByRole('button', { name: 'Crop', exact: true })
        .click();
      await expect(page.locator('.crop-canvas')).toBeVisible({ timeout: 15_000 });
      // Let the modal's pop animation settle before measuring — a boundingBox
      // taken mid-scale draws the crop box a few pixels off between runs.
      await page.waitForTimeout(300);
      // Draw the same deterministic box every run.
      const stage = (await page.locator('.crop-stage').boundingBox())!;
      await page.mouse.move(stage.x + stage.width * 0.2, stage.y + stage.height * 0.15);
      await page.mouse.down();
      await page.mouse.move(stage.x + stage.width * 0.8, stage.y + stage.height * 0.6, {
        steps: 5,
      });
      await page.mouse.up();
      await expect(page.locator('.crop-rect')).toBeVisible();
      await page.mouse.move(0, 0);
      await expect(page).toHaveScreenshot(`crop-${look}.png`);
      await page.locator('.modal-backdrop').click({ position: { x: 10, y: 10 } });
      await expect(page.locator('.modal')).toHaveCount(0);
    });

    await test.step('lightbox', async () => {
      await page.locator('.card').nth(0).dblclick();
      await expect(page.locator('.lightbox-canvas')).toBeVisible({ timeout: 15_000 });
      await page.mouse.move(0, 0);
      await expect(page).toHaveScreenshot(`lightbox-${look}.png`);
      await page.locator('.lightbox-close').click();
      await expect(page.locator('.lightbox-backdrop')).toHaveCount(0);
    });
  });
}
