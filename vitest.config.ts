import { defineConfig } from 'vitest/config';

// Unit tests only (src). Playwright e2e specs live in e2e/ and run via
// `npm run e2e`, not Vitest.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
