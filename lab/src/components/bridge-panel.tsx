'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/client/request'
import { ErrorNote } from '@/components/error-note'
import type { BridgeLanguage } from '@/lib/types'
import type { BridgeRow } from '@/db/schema'

/** The professional bridge. English by default; Finnish for customer wording. */
export function BridgePanel({
  lessonId,
  bridgePrompt,
  bridges,
}: {
  lessonId: string
  bridgePrompt: string
  bridges: BridgeRow[]
}) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [language, setLanguage] = useState<BridgeLanguage>('en')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    setError(null)
    const result = await apiRequest('/api/bridges', {
      body: { lessonId, text: text.trim(), language },
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setText('')
    router.refresh()
  }

  return (
    <div>
      <section className="measure">
        <h3 className="head">The bridge</h3>
        <p className="prose-lab text-chalk">{bridgePrompt}</p>

        <div className="mt-3 inline-flex" role="group" aria-label="Language">
          {(['en', 'fi'] as const).map((value, index) => (
            <button
              key={value}
              type="button"
              className="btn"
              style={{
                borderRadius: index === 0 ? '3px 0 0 3px' : '0 3px 3px 0',
                marginLeft: index === 0 ? 0 : -1,
                background: language === value ? 'var(--slate-high)' : 'transparent',
                color: language === value ? 'var(--chalk)' : 'var(--chalk-dim)',
                borderColor: language === value ? 'var(--chalk-dim)' : 'var(--rule)',
              }}
              aria-pressed={language === value}
              onClick={() => setLanguage(value)}
            >
              {value === 'en' ? 'English' : 'Suomi'}
            </button>
          ))}
        </div>

        <label className="mt-3 block text-xs text-chalk-dim">
          How you would say it
          <textarea
            className="field mt-1"
            rows={6}
            value={text}
            placeholder={
              language === 'fi'
                ? 'Miten sanoisit tämän asiakkaalle'
                : 'Say it the way you would to the person across the table'
            }
            onChange={(event) => setText(event.target.value)}
          />
        </label>

        <button
          type="button"
          className="btn btn-primary mt-3"
          disabled={busy || text.trim().length === 0}
          onClick={() => void save()}
        >
          Save bridge
        </button>
      </section>

      {error ? <ErrorNote message={error} /> : null}

      {bridges.length > 0 ? (
        <section className="mt-6">
          <h3 className="head">Saved bridges</h3>
          <ul className="space-y-4">
            {bridges.map((bridge) => (
              <li key={bridge.id} className="border-b pb-3" style={{ borderColor: 'var(--rule-soft)' }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-chalk-dim">
                    {bridge.language === 'fi' ? 'Suomi' : 'English'}
                  </span>
                  <span className="text-xs text-chalk-dim">
                    {new Date(bridge.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
                <p className="prose-lab mt-1.5 text-chalk">{bridge.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
