'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { apiRequest } from '@/lib/client/request'
import { ErrorNote } from '@/components/error-note'
import type { ConceptProposal } from '@/lib/ai/shapes'

type Row = ConceptProposal & { key: string; state: 'open' | 'accepted' | 'rejected' }

/**
 * Proposed concept rows from the end of a session. Nothing is inserted until
 * it is accepted here, and every field stays editable first.
 */
export function ConceptProposals({
  proposals,
  lessonId,
  onDone,
}: {
  proposals: ConceptProposal[]
  lessonId: string | null
  onDone: () => void
}) {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>(
    proposals.map((proposal, index) => ({
      ...proposal,
      key: `proposal-${index}`,
      state: 'open' as const,
    })),
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (proposals.length === 0) {
    return (
      <section className="mt-4">
        <h3 className="head">Concept rows</h3>
        <p className="text-sm text-chalk-dim">
          Nothing in that session looked like a new concept row.{' '}
          <button type="button" className="btn btn-quiet" onClick={onDone}>
            Hide this
          </button>
        </p>
      </section>
    )
  }

  function edit(key: string, patch: Partial<ConceptProposal>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  async function accept(row: Row) {
    setBusy(true)
    setError(null)
    const result = await apiRequest('/api/concepts', {
      body: {
        concept: row.concept,
        establishedName: row.establishedName,
        myVersion: row.myVersion,
        whereItBreaks: row.whereItBreaks,
        buildLink: row.buildLink,
        status: row.status,
        lessonId,
      },
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, state: 'accepted' } : r)))
    router.refresh()
  }

  const open = rows.filter((row) => row.state === 'open')

  return (
    <section className="mt-5">
      <h3 className="head">Proposed concept rows</h3>
      <p className="mb-3 text-sm text-chalk-dim">
        Edit anything that is not in your own words, then accept it. Nothing is added to the
        register until you do.
      </p>

      <ul className="space-y-4">
        {rows.map((row) => {
          if (row.state === 'accepted') {
            return (
              <li key={row.key} className="text-sm" style={{ color: 'var(--teal)' }}>
                Added: {row.concept}
              </li>
            )
          }
          if (row.state === 'rejected') {
            return (
              <li key={row.key} className="text-sm text-chalk-dim">
                Rejected: {row.concept}
              </li>
            )
          }
          return (
            <li key={row.key} className="panel p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field
                  label="Concept"
                  value={row.concept}
                  onChange={(value) => edit(row.key, { concept: value })}
                />
                <Field
                  label="Established name / source"
                  value={row.establishedName}
                  onChange={(value) => edit(row.key, { establishedName: value })}
                />
                <Field
                  label="My 1-line version"
                  value={row.myVersion}
                  onChange={(value) => edit(row.key, { myVersion: value })}
                />
                <Field
                  label="Where it breaks"
                  value={row.whereItBreaks}
                  onChange={(value) => edit(row.key, { whereItBreaks: value })}
                />
                <Field
                  label="Build link"
                  value={row.buildLink}
                  onChange={(value) => edit(row.key, { buildLink: value })}
                />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || row.concept.trim().length === 0}
                  onClick={() => void accept(row)}
                >
                  <Check size={13} aria-hidden />
                  Add to the register
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() =>
                    setRows((prev) =>
                      prev.map((r) => (r.key === row.key ? { ...r, state: 'rejected' } : r)),
                    )
                  }
                >
                  <X size={13} aria-hidden />
                  Reject
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {error ? <ErrorNote message={error} /> : null}

      {open.length === 0 ? (
        <button type="button" className="btn mt-3" onClick={onDone}>
          Done with the proposals
        </button>
      ) : null}
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block text-xs text-chalk-dim">
      {label}
      <input
        className="field mt-1 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
