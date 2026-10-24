export const THEME_COOKIE = 'lab-theme'

export const THEME_CHOICES = ['system', 'light', 'dark'] as const
export type ThemeChoice = (typeof THEME_CHOICES)[number]

export function parseThemeChoice(value: string | undefined): ThemeChoice {
  return value === 'light' || value === 'dark' ? value : 'system'
}
