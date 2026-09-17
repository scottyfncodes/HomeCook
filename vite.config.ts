import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Relative asset paths, so the build works from any sub-path or static host
  // (GitHub Pages project sites are served from /<repo>/).
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@homecook': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
  server: { host: true, port: 5174 },
});
