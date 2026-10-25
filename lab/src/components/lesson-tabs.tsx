'use client'

import { useState, type ReactNode } from 'react'
import { Marker } from '@/components/loop-strip'
import { LOOP_STEP_LABELS, LOOP_STEPS, type LoopStep } from '@/lib/types'
import type { LoopState } from '@/lib/rules'

/**
 * The five loop steps are the tab strip: the loop state lives where it is
 * acted on, so there is no separate progress widget restating it.
 */
export function LessonTabs({
  loop,
  panels,
  initial,
}: {
  loop: LoopState
  panels: Record<LoopStep, ReactNode>
  initial: LoopStep
}) {
  const [active, setActive] = useState<LoopStep>(initial)

  return (
    <div>
      <div className="overflow-x-auto border-b" role="tablist" aria-label="The learning loop">
        <div className="flex min-w-max">
          {LOOP_STEPS.map((step) => {
            const selected = step === active
            return (
              <button
                key={step}
                type="button"
                role="tab"
                id={`tab-${step}`}
                aria-selected={selected}
                aria-controls={`panel-${step}`}
                className="flex items-center gap-1.5 px-3 py-2 text-sm transitions"
                style={{
                  color: selected ? 'var(--chalk)' : 'var(--chalk-dim)',
                  borderBottom: `2px solid ${selected ? 'var(--ochre)' : 'transparent'}`,
                  marginBottom: -1,
                  background: 'transparent',
                  cursor: 'pointer',
                }}
                onClick={() => setActive(step)}
              >
                <Marker done={loop[step]} />
                {LOOP_STEP_LABELS[step]}
              </button>
            )
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        className="pt-5"
      >
        {panels[active]}
      </div>
    </div>
  )
}
