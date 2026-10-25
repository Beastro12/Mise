import 'server-only'
import { db } from '@/db/client'
import { lessons, modules, type BuildRow, type ConceptRow, type ModuleRow } from '@/db/schema'
import type { LessonWithLoop } from './courses'
import { nextLesson } from './courses'
import { listDueConcepts } from './concepts'
import { listOpenBuilds } from './learning'
import { countOpenParking } from './misc'
import { eq } from 'drizzle-orm'

export type TodayView = {
  next: { lesson: LessonWithLoop; module: ModuleRow } | null
  due: ConceptRow[]
  openBuilds: (BuildRow & { lessonTitle: string; moduleCode: string })[]
  openParking: number
}

export async function getToday(now = new Date()): Promise<TodayView> {
  const [next, due, openBuilds, openParking] = await Promise.all([
    nextLesson(),
    listDueConcepts(now),
    listOpenBuilds(),
    countOpenParking(),
  ])

  const decorated = await Promise.all(
    openBuilds.map(async (build) => {
      const [lesson] = await db
        .select()
        .from(lessons)
        .where(eq(lessons.id, build.lessonId))
        .limit(1)
      const [mod] = lesson
        ? await db.select().from(modules).where(eq(modules.id, lesson.moduleId)).limit(1)
        : []
      return {
        ...build,
        lessonTitle: lesson?.title ?? 'Lesson',
        moduleCode: mod?.code ?? '—',
      }
    }),
  )

  return { next, due, openBuilds: decorated, openParking }
}
