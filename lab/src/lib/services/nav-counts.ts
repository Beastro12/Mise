import 'server-only'
import { db } from '@/db/client'
import { concepts } from '@/db/schema'
import { conceptRank } from '@/lib/rules'
import { listDueConcepts } from './concepts'
import { countOpenParking } from './misc'
import type { NavCounts } from '@/components/nav'

/** The one quiet progress read-out in the rail, plus the two waiting counts. */
export async function navCounts(): Promise<NavCounts> {
  const [all, due, openParking] = await Promise.all([
    db.select().from(concepts),
    listDueConcepts(),
    countOpenParking(),
  ])
  return {
    dueRecall: due.length,
    openParking,
    conceptsTotal: all.length,
    conceptsExplained: all.filter((c) => conceptRank(c.status) >= conceptRank('explained_back'))
      .length,
  }
}
