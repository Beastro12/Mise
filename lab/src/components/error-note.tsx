'use client'

import { AlertTriangle, RotateCcw } from 'lucide-react'

/** Says what went wrong and, when a retry would help, offers one. */
export function ErrorNote({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="mt-3 flex items-start gap-2 rounded border p-3 text-sm measure"
      style={{ borderColor: 'var(--rust)', background: 'var(--rust-quiet)' }}
    >
      <AlertTriangle size={15} aria-hidden style={{ color: 'var(--rust)', marginTop: 2 }} />
      <div className="flex-1">
        <p className="text-chalk">{message}</p>
        {onRetry ? (
          <button type="button" className="btn mt-2" onClick={onRetry}>
            <RotateCcw size={13} aria-hidden />
            Try again
          </button>
        ) : null}
      </div>
    </div>
  )
}
