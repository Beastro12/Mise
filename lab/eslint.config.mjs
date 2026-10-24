import { defineConfig, globalIgnores } from 'eslint/config'
import next from 'eslint-config-next'

export default defineConfig([
  globalIgnores(['.next/**', 'node_modules/**', 'data/**', 'drizzle/**']),
  next,
])
