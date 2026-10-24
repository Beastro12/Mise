import { KeyRound } from 'lucide-react'
import type { EnvProblem } from '@/lib/env'

/**
 * Shown wherever the tutor or grading would run without a key. Every other
 * feature works without one, so this never blocks a page.
 */
export function SetupNotice({
  problems,
  what,
}: {
  problems: EnvProblem[]
  what: string
}) {
  return (
    <section className="panel p-4 measure" style={{ borderColor: 'var(--ochre)' }}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-chalk">
        <KeyRound size={15} aria-hidden style={{ color: 'var(--ochre)' }} />
        {what} needs an API key
      </h2>

      <p className="prose-lab mt-2 text-chalk-dim">
        Create a file called <code className="verbatim">.env.local</code> in the project root
        (next to <code className="verbatim">package.json</code>) and put these lines in it, then
        restart the dev server.
      </p>

      <pre className="verbatim mt-3 overflow-x-auto rounded border p-3" style={{ background: 'var(--ink)' }}>
{problems.map((p) => `${p.variable}=`).join('\n')}
      </pre>

      <dl className="mt-3 space-y-2 text-sm">
        {problems.map((problem) => (
          <div key={problem.variable}>
            <dt className="font-medium text-chalk">{problem.variable}</dt>
            <dd className="text-chalk-dim">{problem.why}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-sm text-chalk-dim">
        <code className="verbatim">.env.example</code> in the project root has the model ids to
        copy. Everything outside the tutor and grading works without a key.
      </p>
    </section>
  )
}
