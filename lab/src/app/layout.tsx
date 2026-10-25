import type { Metadata, Viewport } from 'next'
import { Archivo, Source_Serif_4 } from 'next/font/google'
import './globals.css'
import { cookies } from 'next/headers'
import { Nav } from '@/components/nav'
import { navCounts } from '@/lib/services/nav-counts'
import { parseThemeChoice, THEME_COOKIE } from '@/lib/theme'

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
})

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Lab',
  description: 'A working notebook for learning how AI systems work.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [counts, cookieStore] = await Promise.all([navCounts(), cookies()])

  // Dark is the base; with no cookie the CSS follows the system preference.
  const theme = parseThemeChoice(cookieStore.get(THEME_COOKIE)?.value)

  return (
    <html
      lang="en"
      className={`${archivo.variable} ${sourceSerif.variable}`}
      {...(theme === 'system' ? {} : { 'data-theme': theme })}
    >
      <body className="min-h-dvh">
        <div className="flex">
          <Nav counts={counts} />
          <main className="min-w-0 flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10">{children}</main>
        </div>
      </body>
    </html>
  )
}
