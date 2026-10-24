import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import * as schema from './schema'

/**
 * Absolute path of the SQLite file. One file, ./data/lab.db — copy it to back
 * the whole app up. LAB_DB_FILE overrides it (used by the tests).
 */
export function databaseFile(): string {
  return process.env.LAB_DB_FILE ?? join(process.cwd(), 'data', 'lab.db')
}

export function createDb(file: string = databaseFile()) {
  const dir = dirname(file)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const client = createClient({ url: `file:${file}` })
  return drizzle(client, { schema })
}

export type LabDb = ReturnType<typeof createDb>
export { schema }
