import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Same-origin /ws in dev as in production, so the client needs no branch.
  server: {
    proxy: {
      '/ws': { target: 'ws://localhost:8081', ws: true },
    },
  },
  test: {
    include: ['{src,server}/**/*.test.ts'],
  },
})
