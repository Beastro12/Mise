'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Inbox, Send, Square } from 'lucide-react'
import { apiRequest } from '@/lib/client/request'
import { ErrorNote } from '@/components/error-note'
import type { MessageRole, SessionMode } from '@/lib/types'
import type { ConceptProposal } from '@/lib/ai/shapes'
import { ConceptProposals } from '@/components/concept-proposals'

type Turn = { id: string; role: MessageRole; content: string }

export function TutorChat({
  lessonId,
  mode,
  initialSessionId,
  initialTurns,
  initialSummary,
}: {
  lessonId: string | null
  mode: SessionMode
  initialSessionId: string | null
  initialTurns: Turn[]
  initialSummary: string | null
}) {
  const router = useRouter()
  const [sessionId, setSessionId] = useState(initialSessionId)
  const [turns, setTurns] = useState<Turn[]>(initialTurns)
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamed, setStreamed] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ended, setEnded] = useState(initialSummary !== null)
  const [summary, setSummary] = useState(initialSummary)
  const [proposals, setProposals] = useState<ConceptProposal[] | null>(null)
  const [parkNote, setParkNote] = useState<string | null>(null)
  const lastSent = useRef<string>('')

  async function ensureSession(): Promise<string | null> {
    if (sessionId) return sessionId
    const created = await apiRequest<{ session: { id: string } }>('/api/sessions', {
      body: { lessonId, mode },
    })
    if (!created.ok) {
      setError(created.error)
      return null
    }
    setSessionId(created.data.session.id)
    return created.data.session.id
  }

  async function send(message: string) {
    setError(null)
    const id = await ensureSession()
    if (!id) return

    lastSent.current = message
    setTurns((prev) => [...prev, { id: `local-${Date.now()}`, role: 'user', content: message }])
    setDraft('')
    setStreaming(true)
    setStreamed('')

    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: id, message }),
      })

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setError(
          payload?.error ??
            `The tutor could not be reached (${response.status}). Check the dev server output.`,
        )
        setStreaming(false)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let full = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (line.trim().length === 0) continue
          let event: { type?: string; text?: string; message?: string }
          try {
            event = JSON.parse(line) as typeof event
          } catch {
            continue
          }
          if (event.type === 'text' && event.text) {
            full += event.text
            setStreamed(full)
          } else if (event.type === 'error') {
            setError(event.message ?? 'The tutor stopped mid-answer.')
          }
        }
      }

      if (full.length > 0) {
        setTurns((prev) => [
          ...prev,
          { id: `local-reply-${Date.now()}`, role: 'assistant', content: full },
        ])
      }
      setStreamed('')
    } catch {
      setError('The connection dropped mid-answer. Try again.')
    } finally {
      setStreaming(false)
    }
  }

  async function endSession() {
    if (!sessionId) return
    setError(null)
    setStreaming(true)
    const result = await apiRequest<{ summary: string; proposals: ConceptProposal[] }>(
      `/api/sessions/${sessionId}/end`,
      { body: {} },
    )
    setStreaming(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setEnded(true)
    setSummary(result.data.summary)
    setProposals(result.data.proposals)
    router.refresh()
  }

  async function parkText(text: string) {
    const trimmed = text.trim()
    if (trimmed.length === 0) return
    const result = await apiRequest('/api/parking', {
      body: { text: trimmed, source: sessionId ?? 'manual' },
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setParkNote('Parked.')
    window.setTimeout(() => setParkNote(null), 2500)
    router.refresh()
  }

  /** Parks the selected text if there is a selection, else the whole message. */
  function parkFrom(content: string) {
    const selected = window.getSelection?.()?.toString() ?? ''
    void parkText(selected.trim().length > 0 ? selected : content)
  }

  return (
    <div>
      <div className="panel">
        <div className="max-h-[32rem] overflow-y-auto p-4">
          {turns.length === 0 && streamed.length === 0 ? (
            <p className="prose-lab text-sm text-chalk-dim">
              {mode === 'placement'
                ? 'A placement session: the tutor probes across the whole course to find the gaps.'
                : 'Open with what you already think is going on. The tutor asks before it tells.'}
            </p>
          ) : null}

          <ul className="space-y-4">
            {turns.map((turn) => (
              <li key={turn.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className="text-xs"
                    style={{ color: turn.role === 'user' ? 'var(--ochre)' : 'var(--teal)' }}
                  >
                    {turn.role === 'user' ? 'you' : 'lab'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={() => parkFrom(turn.content)}
                    title="Parks the selected text, or the whole message"
                  >
                    <Inbox size={13} aria-hidden />
                    Park this
                  </button>
                </div>
                <div className="prose-lab mt-1 whitespace-pre-wrap text-chalk">{turn.content}</div>
              </li>
            ))}

            {streamed.length > 0 ? (
              <li>
                <span className="text-xs" style={{ color: 'var(--teal)' }}>
                  lab
                </span>
                <div className="prose-lab mt-1 whitespace-pre-wrap text-chalk">
                  {streamed}
                  <span aria-hidden style={{ color: 'var(--ochre)' }}>
                    ▍
                  </span>
                </div>
              </li>
            ) : null}
          </ul>
        </div>

        {!ended ? (
          <form
            className="border-t p-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (draft.trim().length > 0 && !streaming) void send(draft.trim())
            }}
          >
            <label className="sr-only" htmlFor="tutor-draft">
              Your reply
            </label>
            <textarea
              id="tutor-draft"
              className="field"
              rows={3}
              placeholder="Write a reply…"
              value={draft}
              disabled={streaming}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  if (draft.trim().length > 0 && !streaming) void send(draft.trim())
                }
              }}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={streaming || draft.trim().length === 0}
              >
                <Send size={13} aria-hidden />
                {streaming ? 'Waiting for the tutor' : 'Send'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void endSession()}
                disabled={streaming || !sessionId}
                title="Writes a summary and proposes concept rows"
              >
                <Square size={13} aria-hidden />
                End session
              </button>
              {parkNote ? (
                <span className="text-xs" style={{ color: 'var(--teal)' }}>
                  {parkNote}
                </span>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>

      {error ? (
        <ErrorNote
          message={error}
          onRetry={
            lastSent.current.length > 0 && !streaming
              ? () => void send(lastSent.current)
              : undefined
          }
        />
      ) : null}

      {summary ? (
        <section className="mt-4">
          <h3 className="head">Session summary</h3>
          <p className="prose-lab text-chalk">{summary}</p>
        </section>
      ) : null}

      {proposals ? (
        <ConceptProposals
          proposals={proposals}
          lessonId={lessonId}
          onDone={() => setProposals(null)}
        />
      ) : null}
    </div>
  )
}
