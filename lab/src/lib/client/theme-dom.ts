'use client'

import { THEME_COOKIE, type ThemeChoice } from '@/lib/theme'

/**
 * Writes the theme cookie and applies the attribute straight away, so the
 * change is visible before the server re-render arrives. Kept out of the
 * component so the component body stays free of global mutation.
 */
export function storeTheme(choice: ThemeChoice): void {
  // One year, same-site. A display preference, nothing sensitive.
  document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`

  const root = document.documentElement
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)
}
