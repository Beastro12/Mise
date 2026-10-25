'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Plus, X } from 'lucide-react'
import { apiRequest } from '@/lib/client/request'
import { ErrorNote } from '@/components/error-note'
import type { ParkingStatus } from '@/lib/types'
import type { ParkingRow } from '@/db/schema'

const STATUS_LABEL: Record<ParkingStatus, string> = {
  open: 'open',
  promoted: 'promoted to a lesson note',
  dropped: 'dropped',
}

export function ParkingList({ items }: { items: ParkingRow[] }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function add() {
    setBusy(true)
    setError(null)
    const result = await apiRequest('/api/parking', {
      body: { text: text.trim(), source: 'manual' },
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setText('')
    router.refresh()
  }

  async function setStatus(id: string, status: ParkingStatus) {
    setError(null)
    const result = await apiRequest(`/api/parking/${id}`, { method: 'PATCH', body: { status } })
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  const open = items.filter((item) => item.status === 'open')
  const closed = items.filter((item) => item.status !== 'open')

  return (
    <div>
      <section className="measure">
        <h2 className="head">Park a note</h2>
        <textarea
          className="field"
          rows={3}
          value={text}
          placeholder="The tangent you do not want to lose"
          onChange={(event) => setText(event.target.value)}
        />
        <button
          type="button"
          className="btn btn-primary mt-2"
          disabled={busy || text.trim().length === 0}
          onClick={() => void add()}
        >
          <Plus size={13} aria-hidden />
          Park it
        </button>
      </section>

      {error ? <ErrorNote message={error} /> : null}

      <section className="mt-8">
        <h2 className="head">Open</h2>
        {open.length === 0 ? (
          <p className="text-sm text-chalk-dim">Nothing parked.</p>
        ) : (
          <ul className="space-y-4">
            {open.map((item) => (
              <li key={item.id} className="border-b pb-4" style={{ borderColor: 'var(--rule-soft)' }}>
                <p className="prose-lab text-chalk">{item.text}</p>
                <p className="mt-1.5 text-xs text-chalk-dim">
                  {new Date(item.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {item.source === 'manual' ? ' · added by hand' : ' · from a session'}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void setStatus(item.id, 'promoted')}
                  >
                    <ArrowUpRight size={13} aria-hidden />
                    Promote to a lesson note
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void setStatus(item.id, 'dropped')}
                  >
                    <X size={13} aria-hidden />
                    Drop it
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {closed.length > 0 ? (
        <section className="mt-8">
          <h2 className="head">Settled</h2>
          <ul className="space-y-3">
            {closed.map((item) => (
              <li key={item.id} className="text-sm">
                <p className="text-chalk-dim">{item.text}</p>
                <p className="mt-0.5 flex items-center gap-2 text-xs">
                  <span
                    style={{
                      color: item.status === 'promoted' ? 'var(--teal)' : 'var(--chalk-dim)',
                    }}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                  <button
                    type="button"
                    className="btn btn-quiet"
                    onClick={() => void setStatus(item.id, 'open')}
                  >
                    Reopen
                  </button>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
