import Link from 'next/link'
import { listCompletionEvents } from '@/lib/services/misc'
import { listModules } from '@/lib/services/courses'
import { Empty } from '@/components/empty'

export const dynamic = 'force-dynamic'

function fullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function CompletionPage() {
  const [events, modules] = await Promise.all([listCompletionEvents(), listModules()])

  const perModule = modules.map((mod) => ({
    ...mod,
    completed: events.filter(
      (event) => event.moduleCode === mod.code && event.entityType === 'lesson',
    ).length,
  }))

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-chalk">Completion register</h1>
      <p className="prose-lab mt-2 text-chalk-dim">
        Written automatically, with the evidence that closed each one. Nothing here was ticked by
        hand.
      </p>

      <section className="mt-6">
        <h2 className="head">Totals per module</h2>
        <div className="scroll-x">
          <table className="lab">
          <thead>
            <tr>
              <th scope="col">Module</th>
              <th scope="col">Lessons complete</th>
              <th scope="col">Module check</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {perModule.map((mod) => (
              <tr key={mod.id}>
                <td>
                  <Link href={`/courses/${mod.id}`} className="text-chalk no-underline hover:underline">
                    {mod.code} — {mod.title}
                  </Link>
                </td>
                <td className="tabular-nums text-chalk-dim">
                  {mod.lessonsDone}/{mod.lessonsTotal}
                </td>
                <td
                  className="text-chalk-dim"
                  style={{ color: mod.moduleCheckPassed ? 'var(--teal)' : undefined }}
                >
                  {mod.moduleCheckPassed ? 'passed' : 'not passed'}
                </td>
                <td
                  style={{ color: mod.status === 'complete' ? 'var(--teal)' : 'var(--chalk-dim)' }}
                >
                  {mod.status === 'complete'
                    ? 'complete'
                    : mod.status === 'in_progress'
                      ? 'in progress'
                      : 'not started'}
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="head">Log</h2>
        {events.length === 0 ? (
          <Empty action={{ href: '/courses', label: 'Open the courses' }}>
            Nothing completed yet. A lesson lands here once it has an explain-back graded full, a
            finished build where the lesson has one, and a saved bridge.
          </Empty>
        ) : (
          <ul className="space-y-4">
            {events.map((event) => (
              <li key={event.id} className="border-b pb-4" style={{ borderColor: 'var(--rule-soft)' }}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm text-chalk">
                    {event.moduleCode} · {event.title}
                  </span>
                  <span className="text-xs tabular-nums text-chalk-dim">
                    {fullDate(event.completedAt)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-chalk-dim">
                  {event.entityType === 'module' ? 'Module' : 'Lesson'} · evidence:{' '}
                  {[
                    event.evidence.explainBackIds.length > 0
                      ? `${event.evidence.explainBackIds.length} explain-back${event.evidence.explainBackIds.length === 1 ? '' : 's'} graded full`
                      : null,
                    event.evidence.buildId ? 'a finished build' : null,
                    event.evidence.bridgeId ? 'a saved bridge' : null,
                    event.evidence.recallIds && event.evidence.recallIds.length > 0
                      ? `${event.evidence.recallIds.length} module-check answers`
                      : null,
                    event.evidence.lessonIds && event.evidence.lessonIds.length > 0
                      ? `${event.evidence.lessonIds.length} completed lessons`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(', ') || 'none recorded'}
                </p>
                {event.entityType === 'lesson' ? (
                  <Link
                    href={`/lessons/${event.entityId}`}
                    className="btn btn-quiet mt-1.5 no-underline"
                  >
                    Open the lesson and its evidence
                  </Link>
                ) : (
                  <Link
                    href={`/courses/${event.entityId}`}
                    className="btn btn-quiet mt-1.5 no-underline"
                  >
                    Open the module
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
