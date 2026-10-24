'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { storeTheme } from '@/lib/client/theme-dom'
import type { ThemeChoice } from '@/lib/theme'

/**
 * The chosen theme lives in a cookie, so the server renders data-theme on
 * <html> itself. That means no inline script, no flash before paint, and no
 * hydration mismatch from reading storage during the first client render.
 */
export function ThemeToggle({ value }: { value: ThemeChoice }) {
  const router = useRouter()
  const [choice, setChoice] = useState<ThemeChoice>(value)

  function apply(next: ThemeChoice) {
    setChoice(next)
    storeTheme(next)
    router.refresh()
  }

  const options: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
    { value: 'system', label: 'System', Icon: Monitor },
    { value: 'dark', label: 'Dark', Icon: Moon },
    { value: 'light', label: 'Light', Icon: Sun },
  ]

  return (
    <div className="inline-flex" role="group" aria-label="Theme">
      {options.map(({ value: option, label, Icon }, index) => (
        <button
          key={option}
          type="button"
          className="btn"
          style={{
            borderRadius:
              index === 0 ? '3px 0 0 3px' : index === options.length - 1 ? '0 3px 3px 0' : 0,
            marginLeft: index === 0 ? 0 : -1,
            background: choice === option ? 'var(--slate-high)' : 'transparent',
            color: choice === option ? 'var(--chalk)' : 'var(--chalk-dim)',
            borderColor: choice === option ? 'var(--chalk-dim)' : 'var(--rule)',
            zIndex: choice === option ? 1 : 0,
          }}
          aria-pressed={choice === option}
          onClick={() => apply(option)}
        >
          <Icon size={14} aria-hidden />
          {label}
        </button>
      ))}
    </div>
  )
}
