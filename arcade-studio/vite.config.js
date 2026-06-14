import { defineConfig } from 'vite';

// Local-only creator studio. No remote endpoints, no proxy, no external asset fetch.
// `three` is pre-bundled by Vite from node_modules; everything else is first-party source.
export default defineConfig({
  root: '.',
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5173,
    strictPort: false,
    open: false,
  },
  preview: {
    port: 4173,
    strictPort: false,
  },
});
