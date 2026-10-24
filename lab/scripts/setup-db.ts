/**
 * npm run db:setup — creates the schema and seeds it. Safe to run any number
 * of times: migrations are tracked by Drizzle, and every seed row has a
 * deterministic id inserted with ON CONFLICT DO NOTHING.
 */
import { createDb, databaseFile } from '../src/db/connect'
import { runMigrations, seed, tableCounts } from '../src/db/seed'

async function main() {
  const file = databaseFile()
  console.log(`Database: ${file}`)

  const db = createDb(file)

  await runMigrations(db)
  console.log('Schema is up to date.')

  const inserted = await seed(db)
  const insertedTotal = Object.values(inserted).reduce((a, b) => a + b, 0)
  if (insertedTotal === 0) {
    console.log('Seed content already present; nothing inserted.')
  } else {
    const detail = Object.entries(inserted)
      .filter(([, n]) => n > 0)
      .map(([table, n]) => `${table} +${n}`)
      .join(', ')
    console.log(`Seeded: ${detail}`)
  }

  const counts = await tableCounts(db)
  console.log(
    'Rows: ' +
      Object.entries(counts)
        .map(([t, n]) => `${t} ${n}`)
        .join(' · '),
  )
  console.log('Done. Start the app with: npm run dev')
}

main().catch((error: unknown) => {
  console.error('\ndb:setup failed.')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
