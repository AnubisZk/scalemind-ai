import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Geliştirme sırasında Worker'ları simüle etmek için
      '/api/analysis': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/analysis', ''),
      },
      '/api/ai': {
        target: 'http://localhost:8788',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/ai', ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          state: ['zustand', 'immer'],
        },
      },
    },
  },
})
