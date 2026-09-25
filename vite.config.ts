import { defineConfig } from 'vite';

export default defineConfig({
  base: '/mlqa/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'esbuild',
  },
});
