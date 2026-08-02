import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativo para funcionar em GitHub Pages, Vercel, Netlify ou file://
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
