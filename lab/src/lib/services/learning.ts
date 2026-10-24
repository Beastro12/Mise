import 'server-only'
import { asc, desc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { bridges, builds, explainBacks, lessons, type BuildRow } from '@/db/schema'
import { newId } from '@/lib/ids'
import { buildStatus, canSaveBuildResults, isBlank, isBuildDone } from '@/lib/rules'
import type { BridgeLanguage, Grade } from '@/lib/types'
import { promoteAfterBuild, promoteAfterExplainBack } from './concepts'
import { refreshLesson, touchLesson } from './completion'

// ---------------------------------------------------------------------------
// Explain-backs
// ---------------------------------------------------------------------------

export async function saveExplainBack(input: {
  lessonId: string
  conceptId: string | null
  prompt: string
  answer: string
  grade: Grade
  feedback: string
  missingPieces: string
}) {
  const id = newId()
  await db.insert(explainBacks).values({
    id,
    lessonId: input.lessonId,
    conceptId: input.conceptId,
    prompt: input.prompt,
    answer: input.answer,
    grade: input.grade,
    feedback: input.feedback,
    missingPieces: input.missingPieces,
    createdAt: new Date().toISOString(),
  })

  await touchLesson(input.lessonId)
  if (input.conceptId) await promoteAfterExplainBack(input.conceptId, input.grade)
  const completion = await refreshLesson(input.lessonId)
  return { id, completion }
}

export async function listExplainBacks(lessonId: string) {
  return db
    .select()
    .from(explainBacks)
    .where(eq(explainBacks.lessonId, lessonId))
    .orderBy(desc(explainBacks.createdAt))
}

// ---------------------------------------------------------------------------
// Builds. The prediction must be saved before any results.
// ---------------------------------------------------------------------------

export async function createBuild(input: {
  lessonId: string
  title: string
  prediction: string
  conceptId?: string | null
}) {
  if (isBlank(input.prediction)) {
    throw new BuildRuleError('Write the prediction first: a build starts with what you expect.')
  }
  const id = newId()
  await db.insert(builds).values({
    id,
    lessonId: input.lessonId,
    title: input.title,
    prediction: input.prediction,
    results: '',
    comparison: '',
    status: 'predicted',
    conceptId: input.conceptId ?? null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  })
  await touchLesson(input.lessonId)
  await refreshLesson(input.lessonId)
  return id
}

export class BuildRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BuildRuleError'
  }
}

export async function getBuild(id: string): Promise<BuildRow | null> {
  const [row] = await db.select().from(builds).where(eq(builds.id, id)).limit(1)
  return row ?? null
}

/**
 * Updates a build. Results and comparison are refused while the prediction is
 * empty — the same rule the UI enforces, checked again here so a replayed or
 * hand-made request cannot skip the prediction.
 */
export async function updateBuild(
  id: string,
  patch: {
    title?: string
    prediction?: string
    results?: string
    comparison?: string
    conceptId?: string | null
  },
) {
  const current = await getBuild(id)
  if (!current) throw new BuildRuleError('Build not found.')

  const prediction = patch.prediction ?? current.prediction
  const wantsResults = !isBlank(patch.results) || !isBlank(patch.comparison)

  if (wantsResults && !canSaveBuildResults({ prediction })) {
    throw new BuildRuleError(
      'Save a prediction before the results. The point of the build is to be wrong on the record first.',
    )
  }

  const results = patch.results ?? current.results
  const comparison = patch.comparison ?? current.comparison
  const status = buildStatus({ prediction, results })
  const wasDone = isBuildDone(current)
  const nowDone = status === 'done'

  await db
    .update(builds)
    .set({
      ...(patch.title === undefined ? {} : { title: patch.title }),
      ...(patch.conceptId === undefined ? {} : { conceptId: patch.conceptId }),
      prediction,
      results,
      comparison,
      status,
      completedAt: nowDone ? (current.completedAt ?? new Date().toISOString()) : null,
    })
    .where(eq(builds.id, id))

  const conceptId = patch.conceptId === undefined ? current.conceptId : patch.conceptId
  if (!wasDone && nowDone && conceptId) await promoteAfterBuild(conceptId)

  const completion = await refreshLesson(current.lessonId)
  return { completion, status }
}

export async function listBuilds() {
  return db.select().from(builds).orderBy(desc(builds.createdAt))
}

export async function listOpenBuilds() {
  const all = await db.select().from(builds).orderBy(asc(builds.createdAt))
  return all.filter((b) => b.status !== 'done')
}

// ---------------------------------------------------------------------------
// Bridges
// ---------------------------------------------------------------------------

export async function saveBridge(input: {
  lessonId: string
  text: string
  language: BridgeLanguage
}) {
  const id = newId()
  await db.insert(bridges).values({
    id,
    lessonId: input.lessonId,
    text: input.text,
    language: input.language,
    createdAt: new Date().toISOString(),
  })
  await touchLesson(input.lessonId)
  const completion = await refreshLesson(input.lessonId)
  return { id, completion }
}

export async function listBridges(lessonId: string) {
  return db
    .select()
    .from(bridges)
    .where(eq(bridges.lessonId, lessonId))
    .orderBy(desc(bridges.createdAt))
}

// ---------------------------------------------------------------------------
// Pre-work
// ---------------------------------------------------------------------------

export async function setPreWorkDone(lessonId: string, done: boolean) {
  await db
    .update(lessons)
    .set({ preWorkDoneAt: done ? new Date().toISOString() : null })
    .where(eq(lessons.id, lessonId))
  await touchLesson(lessonId)
}
