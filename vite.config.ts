import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base: './'` keeps built asset URLs relative so the renderer loads correctly
// from the Electron `file://` protocol in a packaged build.
export default defineConfig({
  root: 'client',
  base: './',
  resolve: {
    alias: {
      '@engine': resolve(__dirname, 'engine')
    }
  },
  plugins: [react()],
  server: {
    port: 5177,
    proxy: {
      '/api': 'http://localhost:5178'
    }
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true
  }
})
