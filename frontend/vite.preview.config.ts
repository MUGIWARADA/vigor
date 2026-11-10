import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

/**
 * Build configuration for the self-contained single-file preview
 * (PHASE1-PREVIEW.html). Outputs to dist-preview; scripts/make-single-file.mjs
 * then inlines everything into one HTML file.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
  build: {
    outDir: 'dist-preview',
    rollupOptions: {
      input: path.resolve(__dirname, 'preview.html'),
    },
  },
})
