'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/client/request'
import { ErrorNote } from '@/components/error-note'
import { GradeTag } from '@/components/explain-back-panel'
import { StatusLadder } from '@/components/status-ladder'
import type { ConceptRow } from '@/db/schema'
import type { Grade } from '@/lib/types'

type Question = { question: string; expectedAnswer: string }
type Graded = {
  grade: Grade
  feedback: string
  missingPieces: string
  expectedAnswer: string
  recallBox: number
  nextRecallAt: string | null
}

function shortDate(iso: string | null): string {
  if (!iso) return 'not scheduled'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** One due card at a time: question, answer, grade, feedback, next date. */
export function RecallRunner({ due, canGrade }: { due: ConceptRow[]; canGrade: boolean }) {
  const router = useRouter()
  const [index, setIndex] = useState(0)
  const [question, setQuestion] = useState<Question | null>(null)
  const [answer, setAnswer] = useState('')
  const [graded, setGraded] = useState<Graded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const concept = due[index]

  if (!concept) {
    return (
      <p className="measure text-sm text-chalk-dim">
        {due.length === 0
          ? 'Nothing is due today.'
          : 'That is every card due today. The next one comes back on its own interval.'}
      </p>
    )
  }

  async function loadQuestion() {
    if (!concept) return
    setBusy(true)
    setError(null)
    const result = await apiRequest<Question>('/api/recall/question', {
      body: { conceptId: concept.id },
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setQuestion({ question: result.data.question, expectedAnswer: result.data.expectedAnswer })
  }

  async function submit() {
    if (!question || !concept) return
    setBusy(true)
    setError(null)
    const result = await apiRequest<Graded>('/api/recall', {
      body: {
        conceptId: concept.id,
        question: question.question,
        expectedAnswer: question.expectedAnswer,
        answer: answer.trim(),
      },
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setGraded(result.data)
    router.refresh()
  }

  function nextCard() {
    setIndex((i) => i + 1)
    setQuestion(null)
    setAnswer('')
    setGraded(null)
  }

  return (
    <div className="panel measure p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-chalk-dim">
            Card {index + 1} of {due.length}
          </p>
          <h2 className="mt-0.5 text-base font-semibold text-chalk">{concept.concept}</h2>
        </div>
        <StatusLadder status={concept.status} showLabel />
      </div>

      {!question ? (
        <div className="mt-4">
          <p className="prose-lab text-sm text-chalk-dim">
            Box {concept.recallBox}. Due {shortDate(concept.nextRecallAt)}.
          </p>
          <button
            type="button"
            className="btn btn-primary mt-3"
            disabled={busy || !canGrade}
            onClick={() => void loadQuestion()}
          >
            {busy ? 'Writing the question' : 'Show the question'}
          </button>
          {!canGrade ? (
            <p className="mt-2 text-xs text-chalk-dim">
              Recall needs an API key: it writes the question and grades the answer. See Settings.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-4">
          <p className="prose-lab text-chalk">{question.question}</p>

          {!graded ? (
            <>
              <label className="mt-3 block text-xs text-chalk-dim">
                Your answer
                <textarea
                  className="field mt-1"
                  rows={6}
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
          ) : (
            <div className="mt-4 border-t pt-3">
              <GradeTag grade={graded.grade} />
              <p className="prose-lab mt-1.5 text-sm text-chalk">{graded.feedback}</p>
              {graded.missingPieces ? (
                <p className="prose-lab mt-2 text-sm text-chalk-dim">
                  Missing: {graded.missingPieces}
                </p>
              ) : null}
              {graded.expectedAnswer ? (
                <>
                  <p className="mt-3 text-xs text-chalk-dim">A full answer</p>
                  <p className="prose-lab mt-1 text-sm text-chalk-dim">{graded.expectedAnswer}</p>
                </>
              ) : null}
              <p className="mt-3 text-sm text-chalk-dim">
                Box {graded.recallBox}. Back on {shortDate(graded.nextRecallAt)}.
              </p>
              <button type="button" className="btn btn-primary mt-3" onClick={nextCard}>
                {index + 1 < due.length ? 'Next card' : 'Finish'}
              </button>
            </div>
          )}
        </div>
      )}

      {error ? (
        <ErrorNote
          message={error}
          onRetry={() => (question ? void submit() : void loadQuestion())}
        />
      ) : null}
    </div>
  )
}
