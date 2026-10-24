import { LOOP_STEP_LABELS, LOOP_STEPS, type LoopStep } from '@/lib/types'
import type { LoopState } from '@/lib/rules'

/**
 * The five loop steps. On a lesson these are the tab strip, so the loop state
 * lives where it is acted on rather than in a separate progress widget.
 */
export function LoopStrip({ loop, compact = false }: { loop: LoopState; compact?: boolean }) {
  return (
    <ol className={`flex flex-wrap items-center ${compact ? 'gap-x-3 gap-y-1' : 'gap-x-4 gap-y-2'}`}>
      {LOOP_STEPS.map((step) => {
        const done = loop[step]
        return (
          <li
            key={step}
            className={`flex items-center gap-1.5 ${compact ? 'text-xs' : 'text-sm'}`}
            style={{ color: done ? 'var(--teal)' : 'var(--chalk-dim)' }}
          >
            <Marker done={done} />
            {LOOP_STEP_LABELS[step]}
          </li>
        )
      })}
    </ol>
  )
}

export function Marker({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: done ? 'var(--teal)' : 'transparent',
        border: `1px solid ${done ? 'var(--teal)' : 'var(--rule)'}`,
        display: 'inline-block',
      }}
    />
  )
}

export function stepLabel(step: LoopStep): string {
  return LOOP_STEP_LABELS[step]
}
