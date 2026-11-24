import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { linkPreviewPlugin } from './server/linkPreviewPlugin.ts'

export default defineConfig(({ mode }) => ({
  // Project site: production assets must be rooted at /itinerary-notebook/.
  // Dev (`npm start`) stays on `/` so the local server is unchanged.
  base: mode === 'production' ? '/itinerary-notebook/' : '/',
  plugins: [react(), tailwindcss(), linkPreviewPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 4317,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4317,
    strictPort: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
}))
