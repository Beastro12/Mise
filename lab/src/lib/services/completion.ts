import 'server-only'
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  bridges,
  builds,
  completionEvents,
  concepts,
  explainBacks,
  lessons,
  modules,
  recalls,
} from '@/db/schema'
import { newId } from '@/lib/ids'
import { evaluateLesson, evaluateModule, type LessonCompletion } from '@/lib/rules'
import type { CompletionEvidence, Grade } from '@/lib/types'

/**
 * Recomputes one lesson's completion from its evidence and writes the result.
 * Called after every event that could change it — a graded explain-back, a
 * build reaching done, a saved bridge — never from a checkbox.
 */
export async function refreshLesson(lessonId: string): Promise<LessonCompletion> {
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1)
  if (!lesson) throw new Error('Lesson not found.')

  const [lessonExplainBacks, lessonBuilds, lessonBridges] = await Promise.all([
    db.select().from(explainBacks).where(eq(explainBacks.lessonId, lessonId)),
    db.select().from(builds).where(eq(builds.lessonId, lessonId)),
    db.select().from(bridges).where(eq(bridges.lessonId, lessonId)),
  ])

  const result = evaluateLesson({
    lesson: { buildExercise: lesson.buildExercise },
    explainBacks: lessonExplainBacks,
    builds: lessonBuilds,
    bridges: lessonBridges,
  })

  const [existingEvent] = await db
    .select()
    .from(completionEvents)
    .where(
      and(eq(completionEvents.entityType, 'lesson'), eq(completionEvents.entityId, lessonId)),
    )
    .limit(1)

  const now = new Date().toISOString()

  if (result.complete && result.evidence) {
    if (!existingEvent) {
      const evidence: CompletionEvidence = result.evidence
      await db.insert(completionEvents).values({
        id: newId(),
        entityType: 'lesson',
        entityId: lessonId,
        evidence: JSON.stringify(evidence),
        completedAt: now,
      })
    }
    if (lesson.status !== 'complete') {
      await db
        .update(lessons)
        .set({ status: 'complete', completedAt: existingEvent?.completedAt ?? now })
        .where(eq(lessons.id, lessonId))
    }
  } else {
    // Evidence was removed (an edit, an import). Keep the register truthful.
    if (existingEvent) {
      await db.delete(completionEvents).where(eq(completionEvents.id, existingEvent.id))
    }
    if (lesson.status === 'complete') {
      await db
        .update(lessons)
        .set({ status: 'in_progress', completedAt: null })
        .where(eq(lessons.id, lessonId))
    }
  }

  await refreshModule(lesson.moduleId)
  return result
}

/** Module check runs recorded so far, grouped by run id. */
export async function moduleCheckRuns(moduleId: string): Promise<Grade[][]> {
  const moduleLessons = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId))
  if (moduleLessons.length === 0) return []

  const moduleConcepts = await db
    .select({ id: concepts.id })
    .from(concepts)
    .where(
      inArray(
        concepts.lessonId,
        moduleLessons.map((l) => l.id),
      ),
    )
  if (moduleConcepts.length === 0) return []

  const rows = await db
    .select()
    .from(recalls)
    .where(
      and(
        isNotNull(recalls.moduleCheckRunId),
        inArray(
          recalls.conceptId,
          moduleConcepts.map((c) => c.id),
        ),
      ),
    )
    .orderBy(asc(recalls.createdAt))

  const byRun = new Map<string, Grade[]>()
  for (const row of rows) {
    const runId = row.moduleCheckRunId
    if (!runId) continue
    const list = byRun.get(runId) ?? []
    list.push(row.grade)
    byRun.set(runId, list)
  }
  return [...byRun.values()]
}

/** Recomputes a module: all lessons complete, plus a passed module check. */
export async function refreshModule(moduleId: string) {
  const [mod] = await db.select().from(modules).where(eq(modules.id, moduleId)).limit(1)
  if (!mod) throw new Error('Module not found.')

  const moduleLessons = await db
    .select()
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId))
    .orderBy(asc(lessons.order))

  const result = evaluateModule({
    lessons: moduleLessons,
    moduleCheckRuns: await moduleCheckRuns(moduleId),
  })

  const [existingEvent] = await db
    .select()
    .from(completionEvents)
    .where(
      and(eq(completionEvents.entityType, 'module'), eq(completionEvents.entityId, moduleId)),
    )
    .limit(1)

  const now = new Date().toISOString()

  if (result.complete) {
    if (!existingEvent) {
      const lessonEvents = await db
        .select()
        .from(completionEvents)
        .where(
          and(
            eq(completionEvents.entityType, 'lesson'),
            inArray(
              completionEvents.entityId,
              moduleLessons.map((l) => l.id),
            ),
          ),
        )
      const recallIds = await moduleCheckRecallIds(moduleId)
      const evidence: CompletionEvidence = {
        explainBackIds: lessonEvents.flatMap(
          (e) => (JSON.parse(e.evidence) as CompletionEvidence).explainBackIds,
        ),
        buildId: null,
        bridgeId: null,
        recallIds,
        lessonIds: moduleLessons.map((l) => l.id),
      }
      await db.insert(completionEvents).values({
        id: newId(),
        entityType: 'module',
        entityId: moduleId,
        evidence: JSON.stringify(evidence),
        completedAt: now,
      })
    }
    if (mod.status !== 'complete') {
      await db
        .update(modules)
        .set({ status: 'complete', completedAt: existingEvent?.completedAt ?? now })
        .where(eq(modules.id, moduleId))
    }
    return result
  }

  if (existingEvent) {
    await db.delete(completionEvents).where(eq(completionEvents.id, existingEvent.id))
  }

  const anyProgress =
    result.lessonsDone > 0 ||
    moduleLessons.some((l) => l.status === 'in_progress') ||
    result.bestCheck !== null
  const nextStatus = anyProgress ? 'in_progress' : 'not_started'
  if (mod.status !== nextStatus) {
    await db
      .update(modules)
      .set({ status: nextStatus, completedAt: null })
      .where(eq(modules.id, moduleId))
  }

  return result
}

async function moduleCheckRecallIds(moduleId: string): Promise<string[]> {
  const moduleLessons = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId))
  if (moduleLessons.length === 0) return []
  const moduleConcepts = await db
    .select({ id: concepts.id })
    .from(concepts)
    .where(
      inArray(
        concepts.lessonId,
        moduleLessons.map((l) => l.id),
      ),
    )
  if (moduleConcepts.length === 0) return []
  const rows = await db
    .select({ id: recalls.id })
    .from(recalls)
    .where(
      and(
        isNotNull(recalls.moduleCheckRunId),
        inArray(
          recalls.conceptId,
          moduleConcepts.map((c) => c.id),
        ),
      ),
    )
  return rows.map((r) => r.id)
}

/** Marks a lesson in progress the first time anything happens on it. */
export async function touchLesson(lessonId: string) {
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1)
  if (!lesson) return
  if (lesson.status === 'not_started') {
    await db.update(lessons).set({ status: 'in_progress' }).where(eq(lessons.id, lessonId))
  }
  const [mod] = await db.select().from(modules).where(eq(modules.id, lesson.moduleId)).limit(1)
  if (mod && mod.status === 'not_started') {
    await db.update(modules).set({ status: 'in_progress' }).where(eq(modules.id, mod.id))
  }
}
