/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    // Allow the sandbox preview proxy host during development.
    allowedHosts: true,
    // Dev-server proxy: when the frontend runs in same-origin mode
    // (VITE_API_BASE_URL=/), /api requests are forwarded to the Spring Boot
    // backend — the browser never needs to reach another origin, so no CORS.
    proxy: {
      '/api': {
        target: process.env.VIGOR_API_PROXY ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-radix': [
            '@radix-ui/react-select',
            '@radix-ui/react-dialog',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-slider',
            '@radix-ui/react-switch',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-dropdown-menu',
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
