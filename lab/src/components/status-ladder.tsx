import { CONCEPT_STATUS_LABELS, type ConceptStatus } from '@/lib/types'

/**
 * The signature element. Five rungs that fill and warm from left to right:
 * cool and hollow at met, teal once the field's version has landed, ochre once
 * his own build has used it. Nothing else in the app gets this much colour.
 */
const RUNGS: Record<ConceptStatus, { filled: number; colour: string; outline: boolean }> = {
  met: { filled: 0, colour: 'var(--rule)', outline: false },
  explained_back_partial: { filled: 1, colour: 'var(--chalk-dim)', outline: false },
  explained_back: { filled: 3, colour: 'var(--teal)', outline: false },
  applied: { filled: 4, colour: 'var(--ochre)', outline: false },
  taught: { filled: 5, colour: 'var(--ochre)', outline: true },
}

export function StatusLadder({
  status,
  size = 'md',
  showLabel = false,
}: {
  status: ConceptStatus
  size?: 'sm' | 'md'
  showLabel?: boolean
}) {
  const rung = RUNGS[status]
  const height = size === 'sm' ? 8 : 11
  const width = size === 'sm' ? 7 : 9
  const gap = size === 'sm' ? 2 : 3

  return (
    <span className="inline-flex items-center" style={{ gap: showLabel ? 8 : 0 }}>
      <span
        className="inline-flex items-center"
        style={{ gap }}
        role="img"
        aria-label={`Status: ${CONCEPT_STATUS_LABELS[status]}`}
        title={CONCEPT_STATUS_LABELS[status]}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const on = i < rung.filled
          return (
            <span
              key={i}
              style={{
                width,
                height,
                borderRadius: 1,
                background: on ? rung.colour : 'transparent',
                border: `1px solid ${on ? rung.colour : 'var(--rule)'}`,
                boxShadow: on && rung.outline ? 'inset 0 0 0 1px var(--chalk)' : undefined,
              }}
            />
          )
        })}
      </span>
      {showLabel ? (
        <span
          className="text-xs"
          style={{ color: rung.filled > 0 ? rung.colour : 'var(--chalk-dim)' }}
        >
          {CONCEPT_STATUS_LABELS[status]}
        </span>
      ) : null}
    </span>
  )
}

/** The ladder as a legend, for the register header. */
export function StatusLadderLegend() {
  const order: ConceptStatus[] = [
    'met',
    'explained_back_partial',
    'explained_back',
    'applied',
    'taught',
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {order.map((status) => (
        <StatusLadder key={status} status={status} size="sm" showLabel />
      ))}
    </div>
  )
}
