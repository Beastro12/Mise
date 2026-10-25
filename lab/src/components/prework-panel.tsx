'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { apiRequest } from '@/lib/client/request'
import { ErrorNote } from '@/components/error-note'
import { READ_STATUSES, type ReadStatus } from '@/lib/types'
import type { SourceRow } from '@/db/schema'

const READ_LABEL: Record<ReadStatus, string> = {
  unread: 'Unread',
  reading: 'Reading',
  done: 'Done',
}

export function PreWorkPanel({
  lessonId,
  preWork,
  sources,
  preWorkDoneAt,
}: {
  lessonId: string
  preWork: string
  sources: SourceRow[]
  preWorkDoneAt: string | null
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function setRead(id: string, readStatus: ReadStatus) {
    setError(null)
    const result = await apiRequest(`/api/sources/${id}`, {
      method: 'PATCH',
      body: { readStatus },
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  async function togglePreWork() {
    setBusy(true)
    setError(null)
    const result = await apiRequest(`/api/lessons/${lessonId}/prework`, {
      method: 'PATCH',
      body: { done: preWorkDoneAt === null },
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <div>
      <section className="measure">
        <h3 className="head">Before the session</h3>
        <p className="prose-lab text-chalk">{preWork}</p>
      </section>

      <section className="mt-6">
        <h3 className="head">Sources for this module</h3>
        <ul>
          {sources.map((source) => (
            <li
              key={source.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-2"
              style={{ borderColor: 'var(--rule-soft)' }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-chalk">{source.title}</p>
                <p className="text-xs text-chalk-dim">
                  {source.author} · {source.kind}
                </p>
              </div>
              <select
                className="field"
                style={{ width: 'auto' }}
                aria-label={`Read status for ${source.title}`}
                value={source.readStatus}
                onChange={(event) => void setRead(source.id, event.target.value as ReadStatus)}
              >
                {READ_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {READ_LABEL[status]}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-5">
        <button
          type="button"
          className={preWorkDoneAt === null ? 'btn btn-primary' : 'btn'}
          disabled={busy}
          onClick={() => void togglePreWork()}
        >
          {preWorkDoneAt === null ? (
            'Mark pre-work done'
          ) : (
            <>
              <Check size={13} aria-hidden style={{ color: 'var(--teal)' }} />
              Pre-work done — undo
            </>
          )}
        </button>
        <p className="mt-2 text-xs text-chalk-dim">
          Pre-work is a step in the loop, not a completion requirement: a lesson closes on the
          explain-back, the build and the bridge.
        </p>
      </div>

      {error ? <ErrorNote message={error} /> : null}
    </div>
  )
}
