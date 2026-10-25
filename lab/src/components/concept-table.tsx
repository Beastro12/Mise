'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { apiRequest } from '@/lib/client/request'
import { ErrorNote } from '@/components/error-note'
import { StatusLadder } from '@/components/status-ladder'
import {
  CONCEPT_STATUSES,
  CONCEPT_STATUS_LABELS,
  type ConceptStatus,
} from '@/lib/types'
import type { ConceptRow } from '@/db/schema'

type SortKey = 'concept' | 'status' | 'nextRecallAt' | 'updatedAt'

const RANK: Record<ConceptStatus, number> = {
  met: 0,
  explained_back_partial: 1,
  explained_back: 2,
  applied: 3,
  taught: 4,
}

function shortDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}

export function ConceptTable({
  concepts,
  lessons,
}: {
  concepts: ConceptRow[]
  lessons: { id: string; label: string }[]
}) {
  const router = useRouter()
  const [sort, setSort] = useState<SortKey>('updatedAt')
  const [ascending, setAscending] = useState(false)
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ConceptStatus>('all')
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const filtered = concepts.filter((concept) => {
      if (statusFilter !== 'all' && concept.status !== statusFilter) return false
      if (needle.length === 0) return true
      return [
        concept.concept,
        concept.establishedName,
        concept.myVersion,
        concept.whereItBreaks,
        concept.buildLink,
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })

    const sorted = [...filtered].sort((a, b) => {
      if (sort === 'status') return RANK[a.status] - RANK[b.status]
      if (sort === 'concept') return a.concept.localeCompare(b.concept)
      if (sort === 'nextRecallAt') {
        return (a.nextRecallAt ?? '9999').localeCompare(b.nextRecallAt ?? '9999')
      }
      return a.updatedAt.localeCompare(b.updatedAt)
    })
    return ascending ? sorted : sorted.reverse()
  }, [concepts, filter, statusFilter, sort, ascending])

  function sortBy(key: SortKey) {
    if (sort === key) setAscending((prev) => !prev)
    else {
      setSort(key)
      setAscending(key === 'concept' || key === 'nextRecallAt')
    }
  }

  async function remove(id: string) {
    setError(null)
    const result = await apiRequest(`/api/concepts/${id}`, { method: 'DELETE' })
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  const header = (key: SortKey, label: string) => (
    <th scope="col">
      <button
        type="button"
        className="btn btn-quiet"
        style={{ padding: 0, fontWeight: 600, color: sort === key ? 'var(--chalk)' : undefined }}
        onClick={() => sortBy(key)}
        aria-label={`Sort by ${label}`}
      >
        {label}
        {sort === key ? <span aria-hidden>{ascending ? ' ↑' : ' ↓'}</span> : null}
      </button>
    </th>
  )

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-chalk-dim">
          Search
          <input
            className="field mt-1"
            style={{ width: '14rem' }}
            value={filter}
            placeholder="concept, name, build…"
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
        <label className="text-xs text-chalk-dim">
          Status
          <select
            className="field mt-1"
            style={{ width: 'auto' }}
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as 'all' | ConceptStatus)
            }
          >
            <option value="all">All</option>
            {CONCEPT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {CONCEPT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn ml-auto" onClick={() => setAdding((prev) => !prev)}>
          <Plus size={13} aria-hidden />
          Add a concept
        </button>
      </div>

      {adding ? (
        <ConceptForm
          lessons={lessons}
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            router.refresh()
          }}
        />
      ) : null}

      {error ? <ErrorNote message={error} /> : null}

      {/* Phone: the register as cards. A seven-column table cannot be read at
          this width, and rendering one would make the page scroll sideways. */}
      <ul className="mt-4 sm:hidden">
        {rows.length === 0 ? (
          <li className="py-2 text-sm text-chalk-dim">
            Nothing matches that. Clear the search, or add a concept.
          </li>
        ) : null}
        {rows.map((concept) =>
          editing === concept.id ? (
            <li key={concept.id}>
              <ConceptForm
                concept={concept}
                lessons={lessons}
                onCancel={() => setEditing(null)}
                onSaved={() => {
                  setEditing(null)
                  router.refresh()
                }}
              />
            </li>
          ) : (
            <li key={concept.id} className="border-b py-3" style={{ borderColor: 'var(--rule-soft)' }}>
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-sm font-medium text-chalk">{concept.concept}</p>
                <StatusLadder status={concept.status} size="sm" />
              </div>
              {concept.myVersion ? (
                <p className="mt-1 text-sm" style={{ color: 'var(--ochre)' }}>
                  {concept.myVersion}
                </p>
              ) : null}
              {concept.establishedName ? (
                <p className="mt-1 text-xs" style={{ color: 'var(--teal)' }}>
                  {concept.establishedName}
                </p>
              ) : null}
              {concept.whereItBreaks ? (
                <p className="mt-1 text-xs text-chalk-dim">Breaks: {concept.whereItBreaks}</p>
              ) : null}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs text-chalk-dim">
                <span>{CONCEPT_STATUS_LABELS[concept.status]}</span>
                {concept.buildLink ? <span>{concept.buildLink}</span> : null}
                {concept.nextRecallAt ? (
                  <span className="tabular-nums">
                    box {concept.recallBox} · {shortDate(concept.nextRecallAt)}
                  </span>
                ) : (
                  <span>not scheduled</span>
                )}
                <button
                  type="button"
                  className="btn btn-quiet ml-auto"
                  onClick={() => setEditing(concept.id)}
                >
                  <Pencil size={13} aria-hidden />
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-quiet btn-danger"
                  onClick={() => void remove(concept.id)}
                  aria-label={`Delete ${concept.concept}`}
                >
                  <Trash2 size={13} aria-hidden />
                </button>
              </div>
            </li>
          ),
        )}
      </ul>

      <div className="scroll-x mt-4 hidden sm:block">
        <table className="lab">
          <thead>
            <tr>
              {header('concept', 'Concept')}
              <th scope="col">Established name / source</th>
              <th scope="col">My 1-line version</th>
              <th scope="col">Where it breaks</th>
              <th scope="col">Build link</th>
              {header('status', 'Status')}
              {header('nextRecallAt', 'Next recall')}
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-chalk-dim">
                  Nothing matches that. Clear the search, or add a concept.
                </td>
              </tr>
            ) : null}

            {rows.map((concept) =>
              editing === concept.id ? (
                <tr key={concept.id}>
                  <td colSpan={8}>
                    <ConceptForm
                      concept={concept}
                      lessons={lessons}
                      onCancel={() => setEditing(null)}
                      onSaved={() => {
                        setEditing(null)
                        router.refresh()
                      }}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={concept.id}>
                  <td className="text-chalk">{concept.concept}</td>
                  <td className="text-chalk-dim" style={{ color: 'var(--teal)' }}>
                    {concept.establishedName || '—'}
                  </td>
                  <td style={{ color: 'var(--ochre)' }}>{concept.myVersion || '—'}</td>
                  <td className="text-chalk-dim">{concept.whereItBreaks || '—'}</td>
                  <td className="text-chalk-dim">{concept.buildLink || '—'}</td>
                  <td>
                    <StatusLadder status={concept.status} size="sm" showLabel />
                  </td>
                  <td className="whitespace-nowrap text-chalk-dim tabular-nums">
                    {shortDate(concept.nextRecallAt)}
                    {concept.nextRecallAt ? (
                      <span className="block text-[11px]">box {concept.recallBox}</span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap">
                    <button
                      type="button"
                      className="btn btn-quiet"
                      onClick={() => setEditing(concept.id)}
                      aria-label={`Edit ${concept.concept}`}
                    >
                      <Pencil size={13} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="btn btn-quiet btn-danger"
                      onClick={() => void remove(concept.id)}
                      aria-label={`Delete ${concept.concept}`}
                    >
                      <Trash2 size={13} aria-hidden />
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ConceptForm({
  concept,
  lessons,
  onCancel,
  onSaved,
}: {
  concept?: ConceptRow
  lessons: { id: string; label: string }[]
  onCancel: () => void
  onSaved: () => void
}) {
  const [values, setValues] = useState({
    concept: concept?.concept ?? '',
    establishedName: concept?.establishedName ?? '',
    myVersion: concept?.myVersion ?? '',
    whereItBreaks: concept?.whereItBreaks ?? '',
    buildLink: concept?.buildLink ?? '',
    status: concept?.status ?? ('met' as ConceptStatus),
    lessonId: concept?.lessonId ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    setError(null)
    const body = { ...values, lessonId: values.lessonId === '' ? null : values.lessonId }
    const result = concept
      ? await apiRequest(`/api/concepts/${concept.id}`, { method: 'PATCH', body })
      : await apiRequest('/api/concepts', { body })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onSaved()
  }

  const set = (patch: Partial<typeof values>) => setValues((prev) => ({ ...prev, ...patch }))

  return (
    <div className="panel my-3 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs text-chalk-dim">
          Concept
          <input
            className="field mt-1 text-sm"
            value={values.concept}
            onChange={(event) => set({ concept: event.target.value })}
          />
        </label>
        <label className="block text-xs text-chalk-dim">
          Established name / source
          <input
            className="field mt-1 text-sm"
            value={values.establishedName}
            onChange={(event) => set({ establishedName: event.target.value })}
          />
        </label>
        <label className="block text-xs text-chalk-dim">
          My 1-line version
          <input
            className="field mt-1 text-sm"
            value={values.myVersion}
            onChange={(event) => set({ myVersion: event.target.value })}
          />
        </label>
        <label className="block text-xs text-chalk-dim">
          Where it breaks
          <input
            className="field mt-1 text-sm"
            value={values.whereItBreaks}
            onChange={(event) => set({ whereItBreaks: event.target.value })}
          />
        </label>
        <label className="block text-xs text-chalk-dim">
          Build link
          <input
            className="field mt-1 text-sm"
            value={values.buildLink}
            onChange={(event) => set({ buildLink: event.target.value })}
          />
        </label>
        <label className="block text-xs text-chalk-dim">
          Status
          <select
            className="field mt-1"
            value={values.status}
            onChange={(event) => set({ status: event.target.value as ConceptStatus })}
          >
            {CONCEPT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {CONCEPT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-chalk-dim sm:col-span-2">
          Lesson it belongs to (needed for module checks)
          <select
            className="field mt-1"
            value={values.lessonId}
            onChange={(event) => set({ lessonId: event.target.value })}
          >
            <option value="">Not linked to a lesson</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || values.concept.trim().length === 0}
          onClick={() => void save()}
        >
          {concept ? 'Save changes' : 'Add to the register'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>

      <p className="mt-2 text-xs text-chalk-dim">
        Status set to taught is a manual decision. Everything below it is set by what you do:
        a full explain-back, or a finished build.
      </p>

      {error ? <ErrorNote message={error} /> : null}
    </div>
  )
}
