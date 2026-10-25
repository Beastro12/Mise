'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/client/request'
import { ErrorNote } from '@/components/error-note'
import { GRADE_LABELS, type Grade } from '@/lib/types'
import type { ConceptRow, ExplainBackRow } from '@/db/schema'

const GRADE_COLOUR: Record<Grade, string> = {
  full: 'var(--teal)',
  partial: 'var(--ochre)',
  miss: 'var(--rust)',
}

export function GradeTag({ grade }: { grade: Grade }) {
  return (
    <span className="text-xs" style={{ color: GRADE_COLOUR[grade] }}>
      {GRADE_LABELS[grade]}
    </span>
  )
}

type Graded = {
  grade: Grade
  feedback: string
  missingPieces: string
}

/** Write the answer, have it graded, keep every attempt. Retries allowed. */
export function ExplainBackPanel({
  lessonId,
  objectives,
  concepts,
  history,
  canGrade,
}: {
  lessonId: string
  objectives: string
  concepts: ConceptRow[]
  history: ExplainBackRow[]
  canGrade: boolean
}) {
  const router = useRouter()
  const suggested = `Explain, in your own words: ${objectives.split('.')[0]?.trim() ?? objectives}.`
  const [prompt, setPrompt] = useState(suggested)
  const [answer, setAnswer] = useState('')
  const [conceptId, setConceptId] = useState(concepts[0]?.id ?? '')
  const [result, setResult] = useState<Graded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function grade() {
    setBusy(true)
    setError(null)
    setResult(null)
    const response = await apiRequest<Graded>('/api/explain-backs', {
      body: {
        lessonId,
        conceptId: conceptId === '' ? null : conceptId,
        prompt: prompt.trim(),
        answer: answer.trim(),
      },
    })
    setBusy(false)
    if (!response.ok) {
      setError(response.error)
      return
    }
    setResult(response.data)
    setAnswer('')
    router.refresh()
  }

  return (
    <div>
      <section className="measure">
        <h3 className="head">Explain it back</h3>
        <label className="block text-xs text-chalk-dim">
          The question
          <textarea
            className="field mt-1"
            rows={2}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </label>

        {concepts.length > 0 ? (
          <label className="mt-3 block text-xs text-chalk-dim">
            Concept being explained (a full grade promotes it to explained back)
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

        <label className="mt-3 block text-xs text-chalk-dim">
          Your answer — give the mechanism, not the label
          <textarea
            className="field mt-1"
            rows={7}
            value={answer}
            placeholder="Two or three sentences that say how it actually works"
            onChange={(event) => setAnswer(event.target.value)}
          />
        </label>

        <button
          type="button"
          className="btn btn-primary mt-3"
          disabled={busy || !canGrade || answer.trim().length === 0 || prompt.trim().length === 0}
          onClick={() => void grade()}
        >
          {busy ? 'Grading' : 'Grade my answer'}
        </button>
        {!canGrade ? (
          <p className="mt-2 text-xs text-chalk-dim">
            Grading needs an API key. See Settings for what to add.
          </p>
        ) : null}
      </section>

      {error ? <ErrorNote message={error} onRetry={() => void grade()} /> : null}

      {result ? (
        <section className="panel mt-4 measure p-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-chalk">Graded</span>
            <GradeTag grade={result.grade} />
          </div>
          <p className="prose-lab mt-2 text-sm text-chalk">{result.feedback}</p>
          {result.missingPieces ? (
            <>
              <p className="mt-3 text-xs text-chalk-dim">What was missing</p>
              <p className="prose-lab mt-1 text-sm text-chalk">{result.missingPieces}</p>
            </>
          ) : null}
          {result.grade !== 'full' ? (
            <p className="mt-3 text-xs text-chalk-dim">
              Write it again above. Every attempt is kept.
            </p>
          ) : null}
        </section>
      ) : null}

      {history.length > 0 ? (
        <section className="mt-6">
          <h3 className="head">Earlier attempts</h3>
          <ul className="space-y-4">
            {history.map((attempt) => (
              <li key={attempt.id} className="border-b pb-3" style={{ borderColor: 'var(--rule-soft)' }}>
                <div className="flex items-baseline justify-between gap-2">
                  <GradeTag grade={attempt.grade} />
                  <span className="text-xs text-chalk-dim">
                    {new Date(attempt.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
                <p className="prose-lab mt-1.5 text-sm text-chalk">{attempt.answer}</p>
                <p className="prose-lab mt-2 text-sm text-chalk-dim">{attempt.feedback}</p>
                {attempt.missingPieces ? (
                  <p className="prose-lab mt-1.5 text-sm text-chalk-dim">
                    Missing: {attempt.missingPieces}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
