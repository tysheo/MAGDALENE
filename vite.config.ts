import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'client',
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

