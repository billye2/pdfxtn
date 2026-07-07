import { defineConfig } from '@playwright/test';

// E2E tests load the built extension from dist/, so build first:
//   npm run build && npm run e2e
//
// Projects:
//   functional + a11y — run everywhere (npm run e2e, CI)
//   visual            — macOS-local baselines only (npm run visual); CI skips it
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  // Platform-free snapshot names (grid-blocks.png, not grid-blocks-darwin.png):
  // safe because the visual project never runs on CI.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      // Absolute budget, not a ratio: 1% of 1280×800 would be ~10k px — enough
      // to swallow a real color change on small text (verified: pure-red muted
      // text passed at that tolerance). Same-machine renders are near-identical,
      // so keep just enough slack for canvas antialiasing jitter.
      maxDiffPixels: 100,
      // Per-pixel color sensitivity (pixelmatch YIQ distance). The 0.2 default
      // ignores subtle shade shifts entirely (verified: a 15% darker muted-text
      // color passed); 0.05 catches them while same-machine noise stays ~0.
      threshold: 0.05,
    },
  },
  projects: [
    { name: 'functional', testMatch: /extension\.spec\.ts/ },
    { name: 'a11y', testMatch: /a11y\.spec\.ts/ },
    { name: 'visual', testMatch: /visual\.spec\.ts/ },
  ],
});
