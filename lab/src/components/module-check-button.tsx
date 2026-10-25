'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiRequest } from '@/lib/client/request'
import { ErrorNote } from '@/components/error-note'
import { GradeTag } from '@/components/explain-back-panel'
import { MODULE_CHECK_QUESTIONS, MODULE_CHECK_REQUIRED_FULL } from '@/lib/rules'
import type { Grade } from '@/lib/types'

type Question = {
  conceptId: string
  concept: string
  question: string
  expectedAnswer: string
}

type Answered = {
  grade: Grade
  feedback: string
  missingPieces: string
  expectedAnswer: string
}

/** Runs a module check: four questions in one pass, graded as they are answered. */
export function ModuleCheckButton({
  moduleId,
  disabled,
  disabledReason,
}: {
  moduleId: string
  disabled: boolean
  disabledReason?: string
}) {
  const router = useRouter()
  const [runId, setRunId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [results, setResults] = useState<Answered[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function start() {
    setBusy(true)
    setError(null)
    const response = await apiRequest<{ runId: string; questions: Question[] }>(
      '/api/module-check',
      { body: { moduleId } },
    )
    setBusy(false)
    if (!response.ok) {
      setError(response.error)
      return
    }
    setRunId(response.data.runId)
    setQuestions(response.data.questions)
    setIndex(0)
    setResults([])
    setAnswer('')
  }

  async function submit() {
    const question = questions[index]
    if (!question || !runId) return
    setBusy(true)
    setError(null)
    const response = await apiRequest<Answered>('/api/recall', {
      body: {
        conceptId: question.conceptId,
        question: question.question,
        expectedAnswer: question.expectedAnswer,
        answer: answer.trim(),
        moduleCheckRunId: runId,
      },
    })
    setBusy(false)
    if (!response.ok) {
      setError(response.error)
      return
    }
    setResults((prev) => [...prev, response.data])
    setAnswer('')
    router.refresh()
  }

  if (!runId) {
    return (
      <div>
        <button type="button" className="btn btn-primary" disabled={disabled || busy} onClick={() => void start()}>
          {busy ? 'Writing the questions' : 'Start the module check'}
        </button>
        {disabledReason ? <p className="mt-2 text-xs text-chalk-dim">{disabledReason}</p> : null}
        {error ? <ErrorNote message={error} onRetry={() => void start()} /> : null}
      </div>
    )
  }

  const answeredCount = results.length
  const finished = answeredCount >= questions.length
  const fulls = results.filter((r) => r.grade === 'full').length
  const current = questions[index]
  const lastResult = results[answeredCount - 1]
  const awaitingNext = answeredCount > index

  if (finished) {
    const passed = fulls >= MODULE_CHECK_REQUIRED_FULL && questions.length >= MODULE_CHECK_QUESTIONS
    return (
      <div className="panel measure p-3">
        <p className="text-sm font-medium text-chalk">
          {fulls} of {questions.length} graded full.{' '}
          <span style={{ color: passed ? 'var(--teal)' : 'var(--ochre)' }}>
            {passed ? 'The check is passed.' : 'Not passed — three of four have to be full.'}
          </span>
        </p>
        <ul className="mt-3 space-y-3">
          {results.map((result, i) => (
            <li key={i} className="text-sm">
              <GradeTag grade={result.grade} />
              <p className="prose-lab mt-1 text-chalk-dim">{result.feedback}</p>
            </li>
          ))}
        </ul>
        <button type="button" className="btn mt-3" onClick={() => void start()} disabled={busy}>
          Run the check again
        </button>
      </div>
    )
  }

  return (
    <div className="panel measure p-3">
      <p className="text-xs text-chalk-dim">
        Question {index + 1} of {questions.length} · {current?.concept}
      </p>
      <p className="prose-lab mt-1.5 text-chalk">{current?.question}</p>

      {awaitingNext && lastResult ? (
        <div className="mt-3 border-t pt-3">
          <GradeTag grade={lastResult.grade} />
          <p className="prose-lab mt-1 text-sm text-chalk">{lastResult.feedback}</p>
          {lastResult.missingPieces ? (
            <p className="prose-lab mt-2 text-sm text-chalk-dim">
              Missing: {lastResult.missingPieces}
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn-primary mt-3"
            onClick={() => setIndex((i) => i + 1)}
          >
            Next question
          </button>
        </div>
      ) : (
        <>
          <label className="mt-3 block text-xs text-chalk-dim">
            Your answer
            <textarea
              className="field mt-1"
              rows={5}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary mt-2"
            disabled={busy || answer.trim().length === 0}
            onClick={() => void submit()}
          >
            {busy ? 'Grading' : 'Grade my answer'}
          </button>
        </>
      )}

      {error ? <ErrorNote message={error} /> : null}
    </div>
  )
}
