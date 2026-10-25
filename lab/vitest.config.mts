import { defineConfig } from 'vitest/config'

const here = new URL('./', import.meta.url).pathname

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    alias: {
      '@': `${here}src/`,
      // The service layer imports 'server-only', which throws outside a React
      // server component. The integration test runs the same code in Node.
      'server-only': `${here}tests/server-only-stub.ts`,
    },
  },
})
