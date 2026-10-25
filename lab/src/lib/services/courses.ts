import 'server-only'
import { asc, desc, eq, inArray, or } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  bridges,
  builds,
  concepts,
  explainBacks,
  lessons,
  modules,
  sessions,
  sources,
  type BridgeRow,
  type BuildRow,
  type ConceptRow,
  type ExplainBackRow,
  type LessonRow,
  type ModuleRow,
  type SessionRow,
  type SourceRow,
} from '@/db/schema'
import {
  evaluateLesson,
  evaluateLoop,
  evaluateModule,
  nextLoopStep,
  type LessonCompletion,
  type LoopState,
} from '@/lib/rules'
import { moduleCheckRuns } from './completion'

export type ModuleWithProgress = ModuleRow & {
  lessonsTotal: number
  lessonsDone: number
  moduleCheckPassed: boolean
}

export async function listModules(): Promise<ModuleWithProgress[]> {
  const all = await db.select().from(modules).orderBy(asc(modules.order))
  const out: ModuleWithProgress[] = []
  for (const mod of all) {
    const modLessons = await db
      .select({ id: lessons.id, status: lessons.status })
      .from(lessons)
      .where(eq(lessons.moduleId, mod.id))
    const result = evaluateModule({
      lessons: modLessons,
      moduleCheckRuns: await moduleCheckRuns(mod.id),
    })
    out.push({
      ...mod,
      lessonsTotal: result.lessonsTotal,
      lessonsDone: result.lessonsDone,
      moduleCheckPassed: result.moduleCheckPassed,
    })
  }
  return out
}

export type LessonWithLoop = LessonRow & {
  loop: LoopState
  nextStep: keyof LoopState | null
  completion: LessonCompletion
}

/** Loop state for one lesson, from its own evidence. */
export async function lessonLoop(lesson: LessonRow): Promise<LessonWithLoop> {
  const [lessonExplainBacks, lessonBuilds, lessonBridges, lessonSessions] = await Promise.all([
    db.select().from(explainBacks).where(eq(explainBacks.lessonId, lesson.id)),
    db.select().from(builds).where(eq(builds.lessonId, lesson.id)),
    db.select().from(bridges).where(eq(bridges.lessonId, lesson.id)),
    db.select({ id: sessions.id }).from(sessions).where(eq(sessions.lessonId, lesson.id)),
  ])

  const loop = evaluateLoop({
    lesson: { buildExercise: lesson.buildExercise },
    preWorkDone: lesson.preWorkDoneAt !== null,
    sessionCount: lessonSessions.length,
    explainBacks: lessonExplainBacks,
    builds: lessonBuilds,
    bridges: lessonBridges,
  })

  const completion = evaluateLesson({
    lesson: { buildExercise: lesson.buildExercise },
    explainBacks: lessonExplainBacks,
    builds: lessonBuilds,
    bridges: lessonBridges,
  })

  return { ...lesson, loop, nextStep: nextLoopStep(loop), completion }
}

export type ModuleDetail = {
  module: ModuleWithProgress
  lessons: LessonWithLoop[]
  sources: SourceRow[]
  conceptCount: number
  moduleCheck: Awaited<ReturnType<typeof evaluateModuleFor>>
}

async function evaluateModuleFor(moduleId: string, moduleLessons: LessonRow[]) {
  return evaluateModule({
    lessons: moduleLessons,
    moduleCheckRuns: await moduleCheckRuns(moduleId),
  })
}

export async function getModuleDetail(moduleId: string): Promise<ModuleDetail | null> {
  const [mod] = await db.select().from(modules).where(eq(modules.id, moduleId)).limit(1)
  if (!mod) return null

  const modLessons = await db
    .select()
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId))
    .orderBy(asc(lessons.order))

  const withLoop = await Promise.all(modLessons.map(lessonLoop))
  const moduleCheck = await evaluateModuleFor(moduleId, modLessons)
  const moduleSources = await db
    .select()
    .from(sources)
    .where(or(eq(sources.moduleCode, mod.code), eq(sources.moduleCode, 'all')))
    .orderBy(asc(sources.title))

  const moduleConcepts =
    modLessons.length === 0
      ? []
      : await db
          .select({ id: concepts.id })
          .from(concepts)
          .where(
            inArray(
              concepts.lessonId,
              modLessons.map((l) => l.id),
            ),
          )

  return {
    module: {
      ...mod,
      lessonsTotal: moduleCheck.lessonsTotal,
      lessonsDone: moduleCheck.lessonsDone,
      moduleCheckPassed: moduleCheck.moduleCheckPassed,
    },
    lessons: withLoop,
    sources: moduleSources,
    conceptCount: moduleConcepts.length,
    moduleCheck,
  }
}

export type LessonDetail = {
  lesson: LessonWithLoop
  module: ModuleRow
  sources: SourceRow[]
  sessions: SessionRow[]
  explainBacks: ExplainBackRow[]
  builds: BuildRow[]
  bridges: BridgeRow[]
  concepts: ConceptRow[]
}

export async function getLessonDetail(lessonId: string): Promise<LessonDetail | null> {
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1)
  if (!lesson) return null
  const [mod] = await db.select().from(modules).where(eq(modules.id, lesson.moduleId)).limit(1)
  if (!mod) return null

  const [
    lessonSources,
    lessonSessions,
    lessonExplainBacks,
    lessonBuilds,
    lessonBridges,
    lessonConcepts,
  ] = await Promise.all([
    db
      .select()
      .from(sources)
      .where(or(eq(sources.moduleCode, mod.code), eq(sources.moduleCode, 'all')))
      .orderBy(asc(sources.title)),
    db
      .select()
      .from(sessions)
      .where(eq(sessions.lessonId, lessonId))
      .orderBy(desc(sessions.startedAt)),
    db
      .select()
      .from(explainBacks)
      .where(eq(explainBacks.lessonId, lessonId))
      .orderBy(desc(explainBacks.createdAt)),
    db.select().from(builds).where(eq(builds.lessonId, lessonId)).orderBy(asc(builds.createdAt)),
    db
      .select()
      .from(bridges)
      .where(eq(bridges.lessonId, lessonId))
      .orderBy(desc(bridges.createdAt)),
    db.select().from(concepts).where(eq(concepts.lessonId, lessonId)).orderBy(asc(concepts.concept)),
  ])

  return {
    lesson: await lessonLoop(lesson),
    module: mod,
    sources: lessonSources,
    sessions: lessonSessions,
    explainBacks: lessonExplainBacks,
    builds: lessonBuilds,
    bridges: lessonBridges,
    concepts: lessonConcepts,
  }
}

/** The lesson to work on next: first not-complete lesson in module order. */
export async function nextLesson(): Promise<{ lesson: LessonWithLoop; module: ModuleRow } | null> {
  const orderedModules = await db.select().from(modules).orderBy(asc(modules.order))
  for (const mod of orderedModules) {
    const modLessons = await db
      .select()
      .from(lessons)
      .where(eq(lessons.moduleId, mod.id))
      .orderBy(asc(lessons.order))
    const open = modLessons.find((l) => l.status !== 'complete')
    if (open) return { lesson: await lessonLoop(open), module: mod }
  }
  return null
}
