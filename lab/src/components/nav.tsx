import Link from 'next/link'
import type { ComponentProps } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Beaker,
  BookOpen,
  CheckSquare,
  FlaskConical,
  Inbox,
  Library,
  Settings,
  Sun,
  Table2,
} from 'lucide-react'

export type NavCounts = {
  dueRecall: number
  openParking: number
  conceptsExplained: number
  conceptsTotal: number
}

type NavItem = {
  href: ComponentProps<typeof Link>['href']
  label: string
  Icon: LucideIcon
  count?: keyof NavCounts
}

const items: NavItem[] = [
  { href: '/', label: 'Today', Icon: Sun },
  { href: '/courses', label: 'Courses', Icon: BookOpen },
  { href: '/concepts', label: 'Concepts', Icon: Table2 },
  { href: '/recall', label: 'Recall', Icon: FlaskConical, count: 'dueRecall' },
  { href: '/builds', label: 'Builds', Icon: Beaker },
  { href: '/completion', label: 'Log', Icon: CheckSquare },
  { href: '/parking', label: 'Parking', Icon: Inbox, count: 'openParking' },
  { href: '/sources', label: 'Sources', Icon: Library },
  { href: '/settings', label: 'Settings', Icon: Settings },
]

export function Nav({ counts }: { counts: NavCounts }) {
  return (
    <>
      {/* Desktop: fixed left rail. */}
      <nav
        className="hidden md:flex md:flex-col md:w-44 md:shrink-0 md:border-r md:h-dvh md:sticky md:top-0 px-3 py-4"
        aria-label="Sections"
      >
        <Link href="/" className="flex items-baseline gap-1.5 px-2 pb-4 no-underline">
          <span className="text-base font-semibold tracking-tight text-chalk">Lab</span>
          <span className="text-xs text-chalk-dim">notebook</span>
        </Link>

        <ul className="flex flex-col gap-0.5">
          {items.map(({ href, label, Icon, count }) => {
            const badge = count ? counts[count] : 0
            return (
              <li key={label}>
                <Link
                  href={href}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-chalk-dim no-underline hover:bg-slate hover:text-chalk transitions"
                >
                  <Icon size={15} aria-hidden />
                  <span className="flex-1">{label}</span>
                  {badge > 0 ? (
                    <span
                      className="text-xs tabular-nums"
                      style={{ color: 'var(--ochre)' }}
                      aria-label={`${badge} waiting`}
                    >
                      {badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="mt-auto px-2 pt-4">
          <div className="hairline pt-3 text-xs leading-relaxed text-chalk-dim">
            <span className="tabular-nums text-chalk">
              {counts.conceptsExplained}/{counts.conceptsTotal}
            </span>{' '}
            concepts explained back or better
          </div>
        </div>
      </nav>

      {/* Phone: bottom bar with the five sections used mid-session. */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-20 flex border-t bg-slate"
        aria-label="Sections"
      >
        {items.slice(0, 5).map(({ href, label, Icon, count }) => {
          const badge = count ? counts[count] : 0
          return (
            <Link
              key={label}
              href={href}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-chalk-dim no-underline"
            >
              <Icon size={17} aria-hidden />
              {label}
              {badge > 0 ? (
                <span
                  className="absolute right-1/4 top-1 h-1.5 w-1.5 rounded-full"
                  style={{ background: 'var(--ochre)' }}
                  aria-label={`${badge} waiting`}
                />
              ) : null}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
