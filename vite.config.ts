import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: '/gravitar/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
