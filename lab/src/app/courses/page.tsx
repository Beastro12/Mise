import Link from 'next/link'
import { listModules } from '@/lib/services/courses'

export const dynamic = 'force-dynamic'

const STATUS_WORD = {
  not_started: 'not started',
  in_progress: 'in progress',
  complete: 'complete',
} as const

export default async function CoursesPage() {
  const modules = await listModules()

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-chalk">Courses</h1>
      <p className="prose-lab mt-2 text-chalk-dim">
        In order. A module closes when every lesson is complete and a module check comes back with
        at least three of four answers graded full.
      </p>

      <ul className="mt-6">
        {modules.map((mod) => {
          const fraction = mod.lessonsTotal === 0 ? 0 : mod.lessonsDone / mod.lessonsTotal
          return (
            <li key={mod.id} className="border-b py-4" style={{ borderColor: 'var(--rule-soft)' }}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Link
                  href={`/courses/${mod.id}`}
                  className="text-base font-semibold text-chalk no-underline hover:underline"
                >
                  {mod.code} — {mod.title}
                </Link>
                <span className="text-xs text-chalk-dim">
                  {mod.size === 'short' ? 'short' : 'full'} · {STATUS_WORD[mod.status]}
                </span>
              </div>

              <p className="prose-lab mt-1.5 text-sm text-chalk-dim">{mod.summary}</p>

              <div className="mt-2.5 flex items-center gap-3">
                <div
                  className="h-[3px] w-40 overflow-hidden rounded-sm"
                  style={{ background: 'var(--rule)' }}
                  role="img"
                  aria-label={`${mod.lessonsDone} of ${mod.lessonsTotal} lessons complete`}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.round(fraction * 100)}%`,
                      background: fraction === 1 ? 'var(--teal)' : 'var(--ochre)',
                    }}
                  />
                </div>
                <span className="text-xs tabular-nums text-chalk-dim">
                  {mod.lessonsDone}/{mod.lessonsTotal} lessons
                  {mod.moduleCheckPassed ? ' · check passed' : ''}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
