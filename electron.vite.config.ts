import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      },
      dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client']
    },
    define: {
      // Lit NODE_ENV du process courant (dev → 'development', build → 'production')
      // Ne jamais hardcoder 'development' — ça désactive les optimisations React en prod
      'process.env.NODE_ENV':  JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'process.env.IS_PREACT': JSON.stringify('false')
    },
    optimizeDeps: {
      include: ['@excalidraw/excalidraw'],
      force: true
    },
    plugins: [react(), tailwindcss()]
  }
})
