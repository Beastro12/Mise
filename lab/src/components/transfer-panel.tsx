'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Upload } from 'lucide-react'
import { apiRequest } from '@/lib/client/request'
import { ErrorNote } from '@/components/error-note'

type Counts = Record<string, number>

/** Export is a download. Import replaces everything, after a confirmation. */
export function TransferPanel() {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ name: string; payload: unknown } | null>(null)
  const [done, setDone] = useState<Counts | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function chooseFile(file: File) {
    setError(null)
    setDone(null)
    try {
      const payload = JSON.parse(await file.text()) as unknown
      setPending({ name: file.name, payload })
    } catch {
      setError(`${file.name} is not valid JSON. Pick a file exported from Lab.`)
    }
  }

  async function confirmImport() {
    if (!pending) return
    setBusy(true)
    setError(null)
    const result = await apiRequest<{ imported: Counts }>('/api/import', {
      body: pending.payload,
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setPending(null)
    setDone(result.data.imported)
    if (fileInput.current) fileInput.current.value = ''
    router.refresh()
  }

  return (
    <div>
      <section>
        <h2 className="head">Export</h2>
        <p className="prose-lab text-sm text-chalk-dim">
          The JSON file is the full backup and the only thing import reads. The two Markdown files
          are for pasting back into a Claude Project.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="btn no-underline" href="/api/export" download>
            <Download size={13} aria-hidden />
            Export everything (JSON)
          </a>
          <a className="btn no-underline" href="/api/export/markdown?kind=concepts" download>
            <Download size={13} aria-hidden />
            Concept register (Markdown)
          </a>
          <a className="btn no-underline" href="/api/export/markdown?kind=completion" download>
            <Download size={13} aria-hidden />
            Completion register (Markdown)
          </a>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="head">Import</h2>
        <p className="prose-lab text-sm text-chalk-dim">
          Importing <strong className="text-chalk">replaces everything</strong> currently in the
          database with the contents of the file. Export first if you want a way back.
        </p>

        <label className="mt-3 block text-xs text-chalk-dim">
          Export file
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="field mt-1"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void chooseFile(file)
            }}
          />
        </label>

        {pending ? (
          <div
            className="panel mt-3 measure p-3"
            style={{ borderColor: 'var(--rust)', background: 'var(--rust-quiet)' }}
          >
            <p className="text-sm text-chalk">
              Replace everything with <span className="verbatim">{pending.name}</span>? The
              concepts, sessions, builds and completion log in the app right now will be deleted.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void confirmImport()}
              >
                <Upload size={13} aria-hidden />
                {busy ? 'Importing' : 'Replace everything'}
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => {
                  setPending(null)
                  if (fileInput.current) fileInput.current.value = ''
                }}
              >
                Keep what I have
              </button>
            </div>
          </div>
        ) : null}

        {done ? (
          <p className="mt-3 text-sm" style={{ color: 'var(--teal)' }}>
            Imported{' '}
            {Object.entries(done)
              .filter(([, count]) => count > 0)
              .map(([table, count]) => `${count} ${table}`)
              .join(', ') || 'nothing — the file was empty'}
            .
          </p>
        ) : null}
      </section>

      {error ? <ErrorNote message={error} /> : null}
    </div>
  )
}
