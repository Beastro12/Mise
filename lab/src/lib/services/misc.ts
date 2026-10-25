import 'server-only'
import { asc, desc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  completionEvents,
  lessons,
  modules,
  parkingLot,
  sources,
  type ParkingRow,
  type SourceRow,
} from '@/db/schema'
import { newId } from '@/lib/ids'
import type { CompletionEvidence, ParkingStatus, ReadStatus } from '@/lib/types'

// ---------------------------------------------------------------------------
// Parking lot
// ---------------------------------------------------------------------------

export async function listParking(): Promise<ParkingRow[]> {
  return db.select().from(parkingLot).orderBy(desc(parkingLot.createdAt))
}

export async function countOpenParking(): Promise<number> {
  const rows = await db.select().from(parkingLot).where(eq(parkingLot.status, 'open'))
  return rows.length
}

export async function park(input: { text: string; source: string }): Promise<ParkingRow> {
  const row = {
    id: newId(),
    text: input.text,
    source: input.source,
    status: 'open' as ParkingStatus,
    createdAt: new Date().toISOString(),
  }
  await db.insert(parkingLot).values(row)
  return row
}

export async function setParkingStatus(id: string, status: ParkingStatus) {
  await db.update(parkingLot).set({ status }).where(eq(parkingLot.id, id))
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export async function listSources(): Promise<SourceRow[]> {
  return db.select().from(sources).orderBy(asc(sources.moduleCode), asc(sources.title))
}

export async function setSourceReadStatus(id: string, readStatus: ReadStatus) {
  await db.update(sources).set({ readStatus }).where(eq(sources.id, id))
}

// ---------------------------------------------------------------------------
// Completion register
// ---------------------------------------------------------------------------

export type CompletionEntry = {
  id: string
  entityType: 'lesson' | 'module'
  entityId: string
  completedAt: string
  evidence: CompletionEvidence
  title: string
  moduleCode: string
  moduleTitle: string
}

export async function listCompletionEvents(): Promise<CompletionEntry[]> {
  const [events, allLessons, allModules] = await Promise.all([
    db.select().from(completionEvents).orderBy(desc(completionEvents.completedAt)),
    db.select().from(lessons),
    db.select().from(modules),
  ])

  const lessonById = new Map(allLessons.map((l) => [l.id, l]))
  const moduleById = new Map(allModules.map((m) => [m.id, m]))

  return events.map((event) => {
    let evidence: CompletionEvidence
    try {
      evidence = JSON.parse(event.evidence) as CompletionEvidence
    } catch {
      evidence = { explainBackIds: [], buildId: null, bridgeId: null }
    }

    if (event.entityType === 'lesson') {
      const lesson = lessonById.get(event.entityId)
      const mod = lesson ? moduleById.get(lesson.moduleId) : undefined
      return {
        id: event.id,
        entityType: 'lesson' as const,
        entityId: event.entityId,
        completedAt: event.completedAt,
        evidence,
        title: lesson ? `Lesson ${lesson.order} — ${lesson.title}` : 'Lesson (removed)',
        moduleCode: mod?.code ?? '—',
        moduleTitle: mod?.title ?? '',
      }
    }

    const mod = moduleById.get(event.entityId)
    return {
      id: event.id,
      entityType: 'module' as const,
      entityId: event.entityId,
      completedAt: event.completedAt,
      evidence,
      title: mod ? mod.title : 'Module (removed)',
      moduleCode: mod?.code ?? '—',
      moduleTitle: mod?.title ?? '',
    }
  })
}
