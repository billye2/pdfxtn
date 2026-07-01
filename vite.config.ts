import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    target: 'es2022',
    // The pdf.js worker (~1.4 MB) and the editor core (React + pdf-lib) are
    // inherently large and load from local disk in the packaged extension, not
    // over the network — so the default 500 kB chunk warning isn't meaningful
    // here. On-demand UI (the dialogs + lightbox) is already code-split via
    // React.lazy in App.tsx; this just quiets the noise for the unavoidable core.
    chunkSizeWarningLimit: 1500,
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
