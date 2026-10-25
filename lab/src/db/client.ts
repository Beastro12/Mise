import 'server-only'
import { createDb, databaseFile, schema, type LabDb } from './connect'

// One connection per process. Next reloads modules in dev, so the instance is
// parked on globalThis instead of opening a handle per reload.
const globalForDb = globalThis as unknown as { labDb?: LabDb }

export const db: LabDb = globalForDb.labDb ?? createDb()
if (process.env.NODE_ENV !== 'production') globalForDb.labDb = db

export { databaseFile, schema }
export type { LabDb }
