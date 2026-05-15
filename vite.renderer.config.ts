import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config
export default defineConfig({
  root: 'src/renderer',
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client']
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'process.env.IS_PREACT': JSON.stringify('false')
  },
  optimizeDeps: {
    include: ['@excalidraw/excalidraw'],
    force: true
  },
  plugins: [react(), tailwindcss()]
})
