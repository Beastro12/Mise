import Link from 'next/link'
import { listDueConcepts, listScheduledConcepts } from '@/lib/services/concepts'
import { listModules } from '@/lib/services/courses'
import { readConfig } from '@/lib/env'
import { RecallRunner } from '@/components/recall-runner'
import { ModuleCheckButton } from '@/components/module-check-button'
import { StatusLadder } from '@/components/status-ladder'
import { Empty } from '@/components/empty'

export const dynamic = 'force-dynamic'

function shortDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

export default async function RecallPage() {
  const [due, scheduled, modules] = await Promise.all([
    listDueConcepts(),
    listScheduledConcepts(),
    listModules(),
  ])
  const config = readConfig()
  const upcoming = scheduled.filter((concept) => !due.some((d) => d.id === concept.id))

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-chalk">Recall</h1>
      <p className="prose-lab mt-2 text-chalk-dim">
        Leitner boxes: 1, 3, 7, 16, 35 and 90 days. A full answer moves a concept up a box, a
        partial brings it back tomorrow, a miss sends it back to box 0.
      </p>

      <section className="mt-6">
        <h2 className="head">Due today</h2>
        {due.length === 0 ? (
          <Empty action={{ href: '/concepts', label: 'Open the register' }}>
            Nothing is due. Concepts join the schedule once they reach partial or better.
          </Empty>
        ) : (
          <RecallRunner due={due} canGrade={config.ready} />
        )}
      </section>

      <section className="mt-8">
        <h2 className="head">Module check</h2>
        <p className="prose-lab text-sm text-chalk-dim">
          Four questions on one module&apos;s concepts; three have to come back full. It is the last
          thing a module needs once every lesson is complete.
        </p>
        <ul className="mt-3 space-y-3">
          {modules.map((mod) => (
            <li
              key={mod.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b pb-3"
              style={{ borderColor: 'var(--rule-soft)' }}
            >
              <div>
                <Link
                  href={`/courses/${mod.id}`}
                  className="text-sm text-chalk no-underline hover:underline"
                >
                  {mod.code} — {mod.title}
                </Link>
                <p className="text-xs text-chalk-dim">
                  {mod.lessonsDone}/{mod.lessonsTotal} lessons ·{' '}
                  {mod.moduleCheckPassed ? 'check passed' : 'check not passed'}
                </p>
              </div>
              <ModuleCheckButton
                moduleId={mod.id}
                disabled={!config.ready}
                disabledReason={config.ready ? undefined : 'Needs an API key.'}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="head">Scheduled later</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-chalk-dim">Nothing else is on the schedule yet.</p>
        ) : (
          <ul>
            {upcoming.map((concept) => (
              <li
                key={concept.id}
                className="flex items-center justify-between gap-3 border-b py-2"
                style={{ borderColor: 'var(--rule-soft)' }}
              >
                <span className="min-w-0 flex-1 truncate text-sm text-chalk">
                  {concept.concept}
                </span>
                <StatusLadder status={concept.status} size="sm" />
                <span className="w-28 shrink-0 text-right text-xs tabular-nums text-chalk-dim">
                  box {concept.recallBox} · {shortDate(concept.nextRecallAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
