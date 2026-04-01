import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: '/landitar/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
