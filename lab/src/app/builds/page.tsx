import Link from 'next/link'
import { asc } from 'drizzle-orm'
import { db } from '@/db/client'
import { lessons, modules } from '@/db/schema'
import { listBuilds } from '@/lib/services/learning'
import { Empty } from '@/components/empty'

export const dynamic = 'force-dynamic'

function shortDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function BuildsPage() {
  const [builds, allLessons, allModules] = await Promise.all([
    listBuilds(),
    db.select().from(lessons).orderBy(asc(lessons.order)),
    db.select().from(modules).orderBy(asc(modules.order)),
  ])

  const lessonById = new Map(allLessons.map((l) => [l.id, l]))
  const moduleById = new Map(allModules.map((m) => [m.id, m]))

  return (
    <div className="max-w-4xl">
      <h1 className="text-lg font-semibold tracking-tight text-chalk">Builds</h1>
      <p className="prose-lab mt-2 text-chalk-dim">
        Prediction against result, side by side. The prediction is written first and cannot be
        changed into agreement afterwards.
      </p>

      {builds.length === 0 ? (
        <div className="mt-6">
          <Empty action={{ href: '/courses', label: 'Find a lesson with a build' }}>
            No builds yet. They start from a lesson&apos;s build tab.
          </Empty>
        </div>
      ) : (
        <ul className="mt-6 space-y-6">
          {builds.map((build) => {
            const lesson = lessonById.get(build.lessonId)
            const mod = lesson ? moduleById.get(lesson.moduleId) : undefined
            return (
              <li key={build.id} className="panel p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold text-chalk">{build.title}</h2>
                  <span
                    className="text-xs"
                    style={{
                      color: build.status === 'done' ? 'var(--teal)' : 'var(--ochre)',
                    }}
                  >
                    {build.status}
                  </span>
                </div>

                <p className="mt-1 text-xs text-chalk-dim">
                  {mod ? `${mod.code} · ` : ''}
                  {lesson ? (
                    <Link href={`/lessons/${lesson.id}`} className="no-underline hover:underline">
                      {lesson.title}
                    </Link>
                  ) : (
                    'Lesson removed'
                  )}{' '}
                  · started {shortDate(build.createdAt)}
                  {build.completedAt ? ` · finished ${shortDate(build.completedAt)}` : ''}
                </p>

                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs" style={{ color: 'var(--ochre)' }}>
                      Prediction
                    </p>
                    <div
                      className="verbatim mt-1 rounded border p-2"
                      style={{ background: 'var(--ink)' }}
                    >
                      {build.prediction || '(none)'}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--teal)' }}>
                      Results
                    </p>
                    <div
                      className="verbatim mt-1 rounded border p-2"
                      style={{ background: 'var(--ink)' }}
                    >
                      {build.results || '(waiting)'}
                    </div>
                  </div>
                </div>

                {build.comparison ? (
                  <div className="mt-3">
                    <p className="text-xs text-chalk-dim">Comparison</p>
                    <p className="prose-lab mt-1 text-sm text-chalk">{build.comparison}</p>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
