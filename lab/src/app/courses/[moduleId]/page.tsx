import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getModuleDetail } from '@/lib/services/courses'
import { LoopStrip } from '@/components/loop-strip'
import { ModuleCheckButton } from '@/components/module-check-button'
import { readConfig } from '@/lib/env'

export const dynamic = 'force-dynamic'

export default async function ModulePage({
  params,
}: {
  params: Promise<{ moduleId: string }>
}) {
  const { moduleId } = await params
  const detail = await getModuleDetail(moduleId)
  if (!detail) notFound()

  const config = readConfig()
  const { module: mod, lessons, moduleCheck } = detail

  return (
    <div className="max-w-3xl">
      <Link href="/courses" className="text-xs text-chalk-dim no-underline hover:underline">
        Courses
      </Link>
      <h1 className="mt-1 text-lg font-semibold tracking-tight text-chalk">
        {mod.code} — {mod.title}
      </h1>
      <p className="prose-lab mt-2 text-chalk-dim">{mod.summary}</p>

      <section className="mt-6">
        <h2 className="head">Lessons</h2>
        <ul>
          {lessons.map((lesson) => (
            <li key={lesson.id} className="border-b py-3.5" style={{ borderColor: 'var(--rule-soft)' }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  href={`/lessons/${lesson.id}`}
                  className="text-sm font-medium text-chalk no-underline hover:underline"
                >
                  Lesson {lesson.order} — {lesson.title}
                </Link>
                <span
                  className="text-xs"
                  style={{
                    color: lesson.status === 'complete' ? 'var(--teal)' : 'var(--chalk-dim)',
                  }}
                >
                  {lesson.status === 'complete'
                    ? 'complete'
                    : lesson.status === 'in_progress'
                      ? 'in progress'
                      : 'not started'}
                </span>
              </div>
              <div className="mt-2">
                <LoopStrip loop={lesson.loop} compact />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="head">Module check</h2>
        <p className="prose-lab text-sm text-chalk-dim">
          Four recall questions on this module&apos;s concepts; at least three have to come back
          graded full. {moduleCheck.lessonsDone} of {moduleCheck.lessonsTotal} lessons are
          complete.
          {moduleCheck.moduleCheckPassed
            ? ' The check has been passed.'
            : moduleCheck.bestCheck
              ? ` Best attempt so far: ${moduleCheck.bestCheck.fulls} of ${moduleCheck.bestCheck.questions} full.`
              : ' Not attempted yet.'}
        </p>
        <div className="mt-3">
          <ModuleCheckButton
            moduleId={mod.id}
            disabled={!config.ready}
            disabledReason={
              config.ready
                ? undefined
                : 'A module check needs an API key: it writes the questions and grades the answers. See Settings.'
            }
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="head">Sources for this module</h2>
        <ul className="space-y-1.5 text-sm">
          {detail.sources.map((source) => (
            <li key={source.id} className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-chalk">{source.title}</span>
              <span className="text-xs text-chalk-dim">
                {source.author} · {source.kind} · {source.readStatus}
              </span>
            </li>
          ))}
        </ul>
        <Link href="/sources" className="btn mt-3 no-underline">
          Open the library
        </Link>
      </section>
    </div>
  )
}
