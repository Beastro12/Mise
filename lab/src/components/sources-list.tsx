'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiRequest } from '@/lib/client/request'
import { ErrorNote } from '@/components/error-note'
import { READ_STATUSES, type ReadStatus } from '@/lib/types'
import type { SourceRow } from '@/db/schema'

const READ_LABEL: Record<ReadStatus, string> = {
  unread: 'Unread',
  reading: 'Reading',
  done: 'Done',
}

const READ_COLOUR: Record<ReadStatus, string> = {
  unread: 'var(--chalk-dim)',
  reading: 'var(--ochre)',
  done: 'var(--teal)',
}

export function SourcesList({
  groups,
}: {
  groups: { code: string; label: string; sources: SourceRow[] }[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div>
      {error ? <ErrorNote message={error} /> : null}

      {groups.map((group) => (
        <section key={group.code} className="mt-7">
          <h2 className="head">{group.label}</h2>
          <ul>
            {group.sources.map((source) => (
              <li
                key={source.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b py-2.5"
                style={{ borderColor: 'var(--rule-soft)' }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-chalk">{source.title}</p>
                  <p className="text-xs text-chalk-dim">
                    {source.author} · {source.kind}
                  </p>
                  {source.note ? (
                    <p className="prose-lab mt-1 text-xs text-chalk-dim">{source.note}</p>
                  ) : null}
                </div>
                <span className="text-xs" style={{ color: READ_COLOUR[source.readStatus] }}>
                  {READ_LABEL[source.readStatus]}
                </span>
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
      ))}
    </div>
  )
}
