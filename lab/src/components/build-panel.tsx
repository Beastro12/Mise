'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { apiRequest } from '@/lib/client/request'
import { ErrorNote } from '@/components/error-note'
import type { BuildRow, ConceptRow } from '@/db/schema'

/**
 * Prediction first, then results, then the comparison. The results field stays
 * locked until a prediction is saved — the same rule the API enforces.
 */
export function BuildPanel({
  lessonId,
  buildExercise,
  builds,
  concepts,
}: {
  lessonId: string
  buildExercise: string | null
  builds: BuildRow[]
  concepts: ConceptRow[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [prediction, setPrediction] = useState('')
  const [conceptId, setConceptId] = useState('')

  if (!buildExercise) {
    return (
      <p className="prose-lab text-sm text-chalk-dim">
        This lesson has no build exercise, so the build step counts as done. You can still record
        an experiment from the Builds screen if one comes up.
      </p>
    )
  }

  async function createBuild() {
    setBusy(true)
    setError(null)
    const result = await apiRequest<{ id: string }>('/api/builds', {
      body: {
        lessonId,
        title: title.trim(),
        prediction: prediction.trim(),
        conceptId: conceptId === '' ? null : conceptId,
      },
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setTitle('')
    setPrediction('')
    setConceptId('')
    router.refresh()
  }

  return (
    <div>
      <section>
        <h3 className="head">The exercise</h3>
        <p className="prose-lab text-chalk">{buildExercise}</p>
      </section>

      {builds.length > 0 ? (
        <section className="mt-6">
          <h3 className="head">This lesson&apos;s builds</h3>
          <ul className="space-y-5">
            {builds.map((build) => (
              <li key={build.id}>
                <BuildRecord build={build} concepts={concepts} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6">
        <h3 className="head">Start a build</h3>
        <p className="mb-3 text-sm text-chalk-dim">
          Write what you expect to happen before you run anything. The point is to be wrong on the
          record first.
        </p>
        <div className="measure space-y-3">
          <label className="block text-xs text-chalk-dim">
            What you are running
            <input
              className="field mt-1"
              value={title}
              placeholder="One factual prompt and one open prompt, 5 fresh chats each"
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="block text-xs text-chalk-dim">
            Prediction
            <textarea
              className="field mt-1"
              rows={4}
              value={prediction}
              placeholder="What you expect, and why"
              onChange={(event) => setPrediction(event.target.value)}
            />
          </label>
          {concepts.length > 0 ? (
            <label className="block text-xs text-chalk-dim">
              Concept this build applies (optional — a finished build promotes it to applied)
              <select
                className="field mt-1"
                value={conceptId}
                onChange={(event) => setConceptId(event.target.value)}
              >
                <option value="">No concept linked</option>
                {concepts.map((concept) => (
                  <option key={concept.id} value={concept.id}>
                    {concept.concept}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || title.trim().length === 0 || prediction.trim().length === 0}
            onClick={() => void createBuild()}
          >
            Save prediction
          </button>
        </div>
      </section>

      {error ? <ErrorNote message={error} /> : null}
    </div>
  )
}

function BuildRecord({ build, concepts }: { build: BuildRow; concepts: ConceptRow[] }) {
  const router = useRouter()
  const [results, setResults] = useState(build.results)
  const [comparison, setComparison] = useState(build.comparison)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const predictionSaved = build.prediction.trim().length > 0
  const linked = concepts.find((concept) => concept.id === build.conceptId)

  async function save() {
    setBusy(true)
    setError(null)
    const result = await apiRequest(`/api/builds/${build.id}`, {
      method: 'PATCH',
      body: { results, comparison },
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="panel p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-chalk">{build.title}</span>
        <span
          className="text-xs"
          style={{ color: build.status === 'done' ? 'var(--teal)' : 'var(--ochre)' }}
        >
          {build.status}
        </span>
      </div>
      {linked ? (
        <p className="mt-1 text-xs text-chalk-dim">Applies: {linked.concept}</p>
      ) : null}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs" style={{ color: 'var(--ochre)' }}>
            Prediction
          </p>
          <div className="verbatim mt-1 rounded border p-2" style={{ background: 'var(--ink)' }}>
            {build.prediction || '(empty)'}
          </div>
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--teal)' }}>
            Results
          </p>
          {predictionSaved ? (
            <textarea
              className="field verbatim mt-1"
              rows={5}
              value={results}
              placeholder="What actually happened"
              onChange={(event) => setResults(event.target.value)}
            />
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-chalk-dim">
              <Lock size={12} aria-hidden />
              Locked until a prediction is saved.
            </p>
          )}
        </div>
      </div>

      {predictionSaved ? (
        <div className="mt-3">
          <label className="block text-xs text-chalk-dim">
            Comparison — where the prediction was wrong, and what that tells you
            <textarea
              className="field mt-1"
              rows={3}
              value={comparison}
              onChange={(event) => setComparison(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary mt-2"
            disabled={busy || results.trim().length === 0}
            onClick={() => void save()}
          >
            {build.status === 'done' ? 'Update results' : 'Save results'}
          </button>
        </div>
      ) : null}

      {error ? <ErrorNote message={error} /> : null}
    </div>
  )
}
