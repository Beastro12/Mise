import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLessonDetail } from '@/lib/services/courses'
import { listMessages } from '@/lib/services/sessions'
import { readConfig } from '@/lib/env'
import { LessonTabs } from '@/components/lesson-tabs'
import { PreWorkPanel } from '@/components/prework-panel'
import { TutorChat } from '@/components/tutor-chat'
import { BuildPanel } from '@/components/build-panel'
import { ExplainBackPanel } from '@/components/explain-back-panel'
import { BridgePanel } from '@/components/bridge-panel'
import { SetupNotice } from '@/components/setup-notice'
import type { LoopStep } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>
}) {
  const { lessonId } = await params
  const detail = await getLessonDetail(lessonId)
  if (!detail) notFound()

  const config = readConfig()
  const { lesson, module: mod } = detail

  // Continue the most recent session unless it has already been summarised.
  const latest = detail.sessions[0]
  const openSession = latest && latest.endedAt === null ? latest : null
  const turns = openSession
    ? (await listMessages(openSession.id)).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      }))
    : []

  const initialStep: LoopStep = lesson.nextStep ?? 'session'

  return (
    <div className="max-w-3xl">
      <Link
        href={`/courses/${mod.id}`}
        className="text-xs text-chalk-dim no-underline hover:underline"
      >
        {mod.code} · {mod.title}
      </Link>

      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-chalk">
          Lesson {lesson.order} — {lesson.title}
        </h1>
        <span
          className="text-xs"
          style={{ color: lesson.status === 'complete' ? 'var(--teal)' : 'var(--chalk-dim)' }}
        >
          {lesson.status === 'complete'
            ? 'complete'
            : lesson.status === 'in_progress'
              ? 'in progress'
              : 'not started'}
        </span>
      </div>

      <section className="mt-4">
        <h2 className="head">Objectives</h2>
        <p className="prose-lab text-chalk">{lesson.objectives}</p>
      </section>

      {lesson.completion.missing.length > 0 ? (
        <p className="mt-3 measure text-sm text-chalk-dim">
          To close this lesson: {lesson.completion.missing.join(', ').toLowerCase()}.
        </p>
      ) : (
        <p className="mt-3 measure text-sm" style={{ color: 'var(--teal)' }}>
          Every completion requirement is met; the evidence is in the completion register.
        </p>
      )}

      <div className="mt-6">
        <LessonTabs
          loop={lesson.loop}
          initial={initialStep}
          panels={{
            prework: (
              <PreWorkPanel
                lessonId={lesson.id}
                preWork={lesson.preWork}
                sources={detail.sources}
                preWorkDoneAt={lesson.preWorkDoneAt}
              />
            ),
            session: config.ready ? (
              <TutorChat
                lessonId={lesson.id}
                mode="tutor"
                initialSessionId={openSession?.id ?? null}
                initialTurns={turns}
                initialSummary={latest?.summary ?? null}
              />
            ) : (
              <SetupNotice problems={config.problems} what="The tutor" />
            ),
            build: (
              <BuildPanel
                lessonId={lesson.id}
                buildExercise={lesson.buildExercise}
                builds={detail.builds}
                concepts={detail.concepts}
              />
            ),
            explain_back: config.ready ? (
              <ExplainBackPanel
                lessonId={lesson.id}
                objectives={lesson.objectives}
                concepts={detail.concepts}
                history={detail.explainBacks}
                canGrade
              />
            ) : (
              <SetupNotice problems={config.problems} what="Grading an explain-back" />
            ),
            bridge: (
              <BridgePanel
                lessonId={lesson.id}
                bridgePrompt={lesson.bridgePrompt}
                bridges={detail.bridges}
              />
            ),
          }}
        />
      </div>

      {detail.sessions.filter((s) => s.summary !== null).length > 0 ? (
        <section className="mt-10">
          <h2 className="head">Earlier sessions</h2>
          <ul className="space-y-3">
            {detail.sessions
              .filter((session) => session.summary !== null)
              .map((session) => (
                <li key={session.id} className="border-b pb-3" style={{ borderColor: 'var(--rule-soft)' }}>
                  <p className="text-xs text-chalk-dim">
                    {new Date(session.startedAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}{' '}
                    · {session.mode}
                  </p>
                  <p className="prose-lab mt-1 text-sm text-chalk">{session.summary}</p>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
