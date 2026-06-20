import { defineConfig } from '@playwright/test';

// E2E tests load the built extension from dist/, so build first:
//   npm run build && npm run e2e
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
});
