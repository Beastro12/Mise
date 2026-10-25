import 'server-only'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { concepts, recalls, type ConceptRow } from '@/db/schema'
import { newId } from '@/lib/ids'
import {
  conceptStatusAfterBuildDone,
  conceptStatusAfterExplainBack,
  dueConcepts,
  initialRecallSchedule,
  isScheduledForRecall,
  nextRecallSchedule,
} from '@/lib/rules'
import type { ConceptStatus, Grade } from '@/lib/types'

export async function listConcepts(): Promise<ConceptRow[]> {
  return db.select().from(concepts).orderBy(desc(concepts.updatedAt))
}

export async function getConcept(id: string): Promise<ConceptRow | null> {
  const [row] = await db.select().from(concepts).where(eq(concepts.id, id)).limit(1)
  return row ?? null
}

export async function createConcept(input: {
  concept: string
  establishedName?: string
  myVersion?: string
  whereItBreaks?: string
  buildLink?: string
  status?: ConceptStatus
  lessonId?: string | null
}): Promise<ConceptRow> {
  const now = new Date()
  const status = input.status ?? 'met'
  const schedule = initialRecallSchedule(status, now)
  const row = {
    id: newId(),
    concept: input.concept,
    establishedName: input.establishedName ?? '',
    myVersion: input.myVersion ?? '',
    whereItBreaks: input.whereItBreaks ?? '',
    buildLink: input.buildLink ?? '',
    status,
    lessonId: input.lessonId ?? null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    recallBox: schedule.recallBox,
    nextRecallAt: schedule.nextRecallAt,
    lastRecalledAt: null,
  }
  await db.insert(concepts).values(row)
  return row
}

export async function updateConcept(
  id: string,
  patch: {
    concept?: string
    establishedName?: string
    myVersion?: string
    whereItBreaks?: string
    buildLink?: string
    status?: ConceptStatus
    lessonId?: string | null
  },
): Promise<ConceptRow> {
  const current = await getConcept(id)
  if (!current) throw new Error('Concept not found.')

  const now = new Date()
  const nextStatus = patch.status ?? current.status
  let nextRecallAt = current.nextRecallAt
  let recallBox = current.recallBox

  // Becoming eligible for recall for the first time starts the schedule;
  // dropping back to met takes it off the schedule.
  if (!isScheduledForRecall(current.status) && isScheduledForRecall(nextStatus)) {
    const schedule = initialRecallSchedule(nextStatus, now)
    nextRecallAt = schedule.nextRecallAt
    recallBox = schedule.recallBox
  } else if (!isScheduledForRecall(nextStatus)) {
    nextRecallAt = null
  }

  await db
    .update(concepts)
    .set({
      ...patch,
      status: nextStatus,
      nextRecallAt,
      recallBox,
      updatedAt: now.toISOString(),
    })
    .where(eq(concepts.id, id))

  const updated = await getConcept(id)
  if (!updated) throw new Error('Concept not found after update.')
  return updated
}

export async function deleteConcept(id: string): Promise<void> {
  await db.delete(concepts).where(eq(concepts.id, id))
}

/** Promotion after a graded explain-back. Never demotes. */
export async function promoteAfterExplainBack(conceptId: string, grade: Grade) {
  const current = await getConcept(conceptId)
  if (!current) return
  const next = conceptStatusAfterExplainBack(current.status, grade)
  if (next === current.status) return
  await applyPromotion(current, next)
}

/** Promotion after a build linked to the concept reaches done. */
export async function promoteAfterBuild(conceptId: string) {
  const current = await getConcept(conceptId)
  if (!current) return
  const next = conceptStatusAfterBuildDone(current.status)
  if (next === current.status) return
  await applyPromotion(current, next)
}

async function applyPromotion(current: ConceptRow, next: ConceptStatus) {
  const now = new Date()
  const becomesScheduled =
    !isScheduledForRecall(current.status) && isScheduledForRecall(next)
  const schedule = becomesScheduled ? initialRecallSchedule(next, now) : null

  await db
    .update(concepts)
    .set({
      status: next,
      updatedAt: now.toISOString(),
      ...(schedule
        ? { recallBox: schedule.recallBox, nextRecallAt: schedule.nextRecallAt }
        : {}),
    })
    .where(eq(concepts.id, current.id))
}

export async function listDueConcepts(now = new Date()): Promise<ConceptRow[]> {
  const all = await db.select().from(concepts)
  return dueConcepts(all, now)
}

export async function listScheduledConcepts(): Promise<ConceptRow[]> {
  const all = await db.select().from(concepts).orderBy(asc(concepts.nextRecallAt))
  return all.filter((c) => isScheduledForRecall(c.status) && c.nextRecallAt !== null)
}

/** Records one recall answer and advances the Leitner schedule. */
export async function recordRecall(input: {
  conceptId: string
  question: string
  answer: string
  grade: Grade
  moduleCheckRunId?: string | null
  now?: Date
}) {
  const concept = await getConcept(input.conceptId)
  if (!concept) throw new Error('Concept not found.')
  const now = input.now ?? new Date()

  const recallId = newId()
  await db.insert(recalls).values({
    id: recallId,
    conceptId: input.conceptId,
    question: input.question,
    answer: input.answer,
    grade: input.grade,
    moduleCheckRunId: input.moduleCheckRunId ?? null,
    createdAt: now.toISOString(),
  })

  const schedule = nextRecallSchedule({
    recallBox: concept.recallBox,
    status: concept.status,
    grade: input.grade,
    now,
  })

  await db
    .update(concepts)
    .set({
      recallBox: schedule.recallBox,
      nextRecallAt: schedule.nextRecallAt,
      lastRecalledAt: schedule.lastRecalledAt,
      updatedAt: now.toISOString(),
    })
    .where(eq(concepts.id, input.conceptId))

  return { recallId, schedule }
}

export async function recallHistory(conceptId: string) {
  return db
    .select()
    .from(recalls)
    .where(eq(recalls.conceptId, conceptId))
    .orderBy(desc(recalls.createdAt))
}

export async function conceptCountsByStatus() {
  const rows = await db
    .select({ status: concepts.status, count: sql<number>`count(*)` })
    .from(concepts)
    .groupBy(concepts.status)
  return rows
}

/** Concepts linked to any lesson of a module, for the module check. */
export async function conceptsForModuleLessons(lessonIds: string[]): Promise<ConceptRow[]> {
  if (lessonIds.length === 0) return []
  const all = await db.select().from(concepts)
  return all.filter((c) => c.lessonId !== null && lessonIds.includes(c.lessonId))
}

export async function findConceptByName(name: string): Promise<ConceptRow | null> {
  const [row] = await db
    .select()
    .from(concepts)
    .where(and(eq(concepts.concept, name)))
    .limit(1)
  return row ?? null
}
