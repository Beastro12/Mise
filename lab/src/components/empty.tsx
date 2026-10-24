import Link from 'next/link'
import type { ComponentProps } from 'react'

/** Empty states point at the action that fills them. */
export function Empty({
  children,
  action,
}: {
  children: React.ReactNode
  action?: { href: ComponentProps<typeof Link>['href']; label: string }
}) {
  return (
    <div className="measure py-2 text-sm text-chalk-dim">
      <p>{children}</p>
      {action ? (
        <Link href={action.href} className="btn mt-3 no-underline">
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}
