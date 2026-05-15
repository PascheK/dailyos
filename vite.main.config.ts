import { defineConfig } from 'vite'

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext']
  },
  build: {
    rollupOptions: {
      external: [
        'better-sqlite3',
        'bindings',
        'file-uri-to-path',
        'node-gyp-build'
      ]
    }
  }
})
