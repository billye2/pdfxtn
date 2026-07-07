// Automated accessibility scans (axe-core, WCAG 2.0/2.1 A + AA) across the
// app's key states, in the default look and the dark one (contrast rules).
// Scoped to WCAG tags — the best-practice ruleset (landmarks etc.) is noise
// for a single-purpose extension page.
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { launchExtension, openEditor, drop, pdf, makePdf, samplePdf } from './helpers';

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  ({ context, extensionId } = await launchExtension());
});

test.afterAll(async () => {
  await context?.close();
});

const META = process.platform === 'darwin' ? 'Meta' : 'Control';

// Deliberate design exclusion (owner decision, 2026-07-07): the playful branded
// action buttons keep white text on bright accent colors at ~2–3.5:1, below
// WCAG AA's 4.5:1. They are excluded from the scan so color-contrast still
// guards everything else — menus, dialogs, banners, and muted text, where the
// real shipped bugs (black-on-dark menu, white-on-white banner) lived.
const BRAND_BUTTON_EXCLUSIONS = [
  '.btn-go',
  '.btn-add',
  '.btn-crop',
  '.btn-split',
  '.btn-del',
  '.btn-rotate',
  '.save-btn',
  '.seg-btn.active',
];

async function checkA11y(page: Page, label: string) {
  // Let entrance animations/transitions (menu pop, modal fade ≤180ms) finish —
  // axe folds mid-animation element opacity into its color-contrast math and
  // reports nonsense ratios otherwise.
  await page.waitForTimeout(350);
  let builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
  ]);
  for (const sel of BRAND_BUTTON_EXCLUSIONS) builder = builder.exclude(sel);
  const results = await builder.analyze();
  const violations = results.violations.map(
    (v) => `${v.id} [${v.impact}]: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  );
  expect(violations, label).toEqual([]);
}

for (const look of ['blocks', 'midnight'] as const) {
  test(`a11y: key states are violation-free in the "${look}" look`, async () => {
    const page = await openEditor(context, extensionId);

    await test.step('switch look', async () => {
      if (look !== 'blocks') {
        await page.locator('.look-trigger').click();
        await page.locator('.look-option', { hasText: 'Nighty Night' }).click();
        await expect(page.locator('.app')).toHaveAttribute('data-look', look);
      }
    });

    await test.step('empty state', async () => {
      await checkA11y(page, `${look}: empty state`);
    });

    await test.step('editor grid + selection dock', async () => {
      // Two docs so the Mix dialog is openable later.
      await drop(page, [
        pdf('sample.pdf', await samplePdf()),
        pdf('extra.pdf', await makePdf([[400, 600]])),
      ]);
      await expect(page.locator('.card')).toHaveCount(7);
      await page.locator('.card').nth(0).click();
      await page
        .locator('.card')
        .nth(2)
        .click({ modifiers: [META] });
      await page
        .locator('.card')
        .nth(4)
        .click({ modifiers: [META] });
      await expect(page.locator('.dock')).toBeVisible();
      await checkA11y(page, `${look}: grid + dock`);
    });

    await test.step('look menu open', async () => {
      await page.locator('.look-trigger').click();
      await expect(page.locator('.look-menu')).toBeVisible();
      await checkA11y(page, `${look}: look menu`);
      // Escape can be swallowed by axe's injected frames — close via backdrop.
      await page.locator('.look-backdrop').click();
      await expect(page.locator('.look-menu')).toHaveCount(0);
    });

    const dialogs: Array<{ open: string; ready: string }> = [
      { open: 'Crop', ready: '.crop-canvas' },
      { open: 'Export range…', ready: '.modal' },
      { open: 'Export images…', ready: '.modal' },
      { open: 'Split every…', ready: '.modal' },
      { open: 'Mix', ready: '.modal' },
    ];
    for (const d of dialogs) {
      await test.step(`${d.open} dialog`, async () => {
        await page
          .locator('.toolbar')
          .getByRole('button', { name: d.open, exact: true })
          .click();
        await expect(page.locator(d.ready).first()).toBeVisible({ timeout: 15_000 });
        await checkA11y(page, `${look}: ${d.open} dialog`);
        await page.locator('.modal-backdrop').click({ position: { x: 10, y: 10 } });
        await expect(page.locator('.modal')).toHaveCount(0);
      });
    }

    await test.step('lightbox', async () => {
      await page.locator('.card').nth(0).dblclick();
      await expect(page.locator('.lightbox-canvas')).toBeVisible({ timeout: 15_000 });
      await checkA11y(page, `${look}: lightbox`);
      await page.locator('.lightbox-close').click();
      await expect(page.locator('.lightbox-backdrop')).toHaveCount(0);
    });

    await test.step('restore banner', async () => {
      await page.waitForTimeout(1200); // let the debounced autosave flush
      await page.reload();
      await expect(page.locator('.restore-banner')).toBeVisible({ timeout: 5_000 });
      await checkA11y(page, `${look}: restore banner`);
      await page
        .locator('.restore-banner')
        .getByRole('button', { name: 'Discard' })
        .click();
      await expect(page.locator('.restore-banner')).toHaveCount(0);
    });

    // Tidy up so state doesn't leak into other tests/looks.
    await page.evaluate(
      () =>
        new Promise<void>((res) => {
          localStorage.clear();
          const r = indexedDB.deleteDatabase('pdf-mana');
          r.onsuccess = r.onerror = r.onblocked = () => res();
        }),
    );
    await page.close();
  });
}
