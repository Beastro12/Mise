import Link from 'next/link'
import { LOOP_STEP_LABELS } from '@/lib/types'
import { getToday } from '@/lib/services/today'
import { StatusLadder } from '@/components/status-ladder'
import { Empty } from '@/components/empty'

export const dynamic = 'force-dynamic'

function dayLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function shortDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default async function TodayPage() {
  const now = new Date()
  const { next, due, openBuilds, openParking } = await getToday(now)

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-chalk">{dayLabel(now)}</h1>

      {/* Next step in the loop */}
      <section className="mt-5">
        {next ? (
          <div className="panel edge p-4">
            <p className="text-xs text-chalk-dim">
              {next.module.code} · {next.module.title}
            </p>
            <h2 className="mt-1 text-base font-semibold text-chalk">
              Lesson {next.lesson.order} — {next.lesson.title}
            </h2>
            <p className="mt-2 text-sm text-chalk-dim">
              {next.lesson.nextStep
                ? `Next step: ${LOOP_STEP_LABELS[next.lesson.nextStep]}.`
                : 'Every step is done; the lesson closes as soon as the register catches up.'}
              {next.lesson.completion.missing.length > 0
                ? ` Still needed: ${next.lesson.completion.missing.join(', ').toLowerCase()}.`
                : ''}
            </p>
            <Link href={`/lessons/${next.lesson.id}`} className="btn btn-primary mt-3 no-underline">
              Open the lesson
            </Link>
          </div>
        ) : (
          <Empty action={{ href: '/courses', label: 'Look at the courses' }}>
            Every lesson is complete. Nothing is queued.
          </Empty>
        )}
      </section>

      {/* Recall due today */}
      <section className="mt-8">
        <h2 className="head">Due for recall today</h2>
        {due.length === 0 ? (
          <Empty action={{ href: '/concepts', label: 'Open the concept register' }}>
            Nothing is due. Cards appear here once a concept reaches partial or better and its
            interval comes round.
          </Empty>
        ) : (
          <>
            <ul>
              {due.map((concept) => (
                <li
                  key={concept.id}
                  className="flex items-center justify-between gap-3 border-b py-2"
                  style={{ borderColor: 'var(--rule-soft)' }}
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-chalk">
                    {concept.concept}
                  </span>
                  <StatusLadder status={concept.status} size="sm" />
                  <span className="w-24 shrink-0 text-right text-xs tabular-nums text-chalk-dim">
                    box {concept.recallBox} · {shortDate(concept.nextRecallAt)}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/recall" className="btn btn-primary mt-3 no-underline">
              Start recall
            </Link>
          </>
        )}
      </section>

      {/* Builds waiting for results */}
      <section className="mt-8">
        <h2 className="head">Builds waiting for results</h2>
        {openBuilds.length === 0 ? (
          <Empty action={{ href: '/builds', label: 'See all builds' }}>
            No build is waiting. A build opens with a prediction and closes when you have compared
            it against what actually happened.
          </Empty>
        ) : (
          <ul className="space-y-3">
            {openBuilds.map((build) => (
              <li key={build.id} className="border-b pb-3" style={{ borderColor: 'var(--rule-soft)' }}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm text-chalk">{build.title}</span>
                  <span className="text-xs text-chalk-dim">
                    {build.moduleCode} · {build.status === 'predicted' ? 'predicted' : 'planned'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-chalk-dim">
                  {build.status === 'predicted'
                    ? `Prediction saved ${shortDate(build.createdAt)}.`
                    : 'No prediction yet.'}
                </p>
                <Link href={`/lessons/${build.lessonId}`} className="btn mt-2 no-underline">
                  {build.status === 'predicted' ? 'Add results' : 'Save prediction'}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Parking lot */}
      <section className="mt-8">
        <h2 className="head">Parking lot</h2>
        {openParking === 0 ? (
          <Empty action={{ href: '/parking', label: 'Open the parking lot' }}>
            Nothing parked. Tangents from a session land here instead of derailing it.
          </Empty>
        ) : (
          <p className="text-sm text-chalk-dim">
            <Link href="/parking" className="text-chalk">
              {openParking} open {openParking === 1 ? 'note' : 'notes'}
            </Link>{' '}
            waiting to be promoted or dropped.
          </p>
        )}
      </section>
    </div>
  )
}
