import { asc } from 'drizzle-orm'
import { db } from '@/db/client'
import { lessons, modules } from '@/db/schema'
import { listConcepts } from '@/lib/services/concepts'
import { ConceptTable } from '@/components/concept-table'
import { StatusLadderLegend } from '@/components/status-ladder'

export const dynamic = 'force-dynamic'

export default async function ConceptsPage() {
  const [concepts, allLessons, allModules] = await Promise.all([
    listConcepts(),
    db.select().from(lessons).orderBy(asc(lessons.order)),
    db.select().from(modules).orderBy(asc(modules.order)),
  ])

  const moduleById = new Map(allModules.map((m) => [m.id, m]))
  const lessonOptions = allModules.flatMap((mod) =>
    allLessons
      .filter((lesson) => lesson.moduleId === mod.id)
      .map((lesson) => ({
        id: lesson.id,
        label: `${moduleById.get(lesson.moduleId)?.code ?? '—'} L${lesson.order} — ${lesson.title}`,
      })),
  )

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight text-chalk">Concept register</h1>
      <p className="prose-lab mt-2 text-chalk-dim">
        What you have met, what you can explain back, what you have built with, and what you could
        teach. Teal is the field&apos;s version; ochre is yours.
      </p>

      <div className="mt-4">
        <StatusLadderLegend />
      </div>

      <div className="mt-6">
        <ConceptTable concepts={concepts} lessons={lessonOptions} />
      </div>
    </div>
  )
}
