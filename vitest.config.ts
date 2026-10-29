import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '#server': fileURLToPath(new URL('./server', import.meta.url)),
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  oxc: {
    decorator: { legacy: true },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
})
