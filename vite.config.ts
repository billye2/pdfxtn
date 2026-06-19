import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        editor: 'src/editor/index.html',
      },
    },
  },
  // Required so the CRXJS HMR websocket works in the extension context during dev.
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
});
