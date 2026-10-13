import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

// GitHub Pages servuje projekt na /<názov-repa>/ (build aj `vite preview`), lokálny dev na /.
const REPO_BASE = '/Purgatory-Sons-Underworld-Logistics/';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview === true ? REPO_BASE : '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0, // pixel-art sprity nechceme inlinovať ako base64
    sourcemap: true,
    chunkSizeWarningLimit: 1600, // Phaser má ~1.2 MB, varovanie je očakávané
  },
}));
