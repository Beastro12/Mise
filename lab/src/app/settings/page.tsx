import { cookies } from 'next/headers'
import { readConfig } from '@/lib/env'
import { databaseFile } from '@/db/client'
import { ThemeToggle } from '@/components/theme-toggle'
import { TransferPanel } from '@/components/transfer-panel'
import { SetupNotice } from '@/components/setup-notice'
import { parseThemeChoice, THEME_COOKIE } from '@/lib/theme'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const config = readConfig()
  const theme = parseThemeChoice((await cookies()).get(THEME_COOKIE)?.value)

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-chalk">Settings</h1>

      <section className="mt-6">
        <h2 className="head">Models and key</h2>
        <p className="prose-lab text-sm text-chalk-dim">
          Read from the environment, not editable here: change <span className="verbatim">.env.local</span>{' '}
          and restart the dev server. The key stays on the server and is never sent to the browser.
        </p>
        <div className="scroll-x mt-3">
          <table className="lab">
          <tbody>
            <tr>
              <th scope="row" style={{ width: '12rem' }}>
                ANTHROPIC_API_KEY
              </th>
              <td style={{ color: config.hasApiKey ? 'var(--teal)' : 'var(--rust)' }}>
                {config.hasApiKey ? 'set' : 'not set'}
              </td>
            </tr>
            <tr>
              <th scope="row">LAB_TUTOR_MODEL</th>
              <td className="verbatim">{config.tutorModel || '(not set)'}</td>
            </tr>
            <tr>
              <th scope="row">LAB_GRADER_MODEL</th>
              <td className="verbatim">{config.graderModel || '(not set)'}</td>
            </tr>
          </tbody>
          </table>
        </div>

        {!config.ready ? (
          <div className="mt-4">
            <SetupNotice problems={config.problems} what="The tutor and grading" />
          </div>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="head">Theme</h2>
        <p className="prose-lab text-sm text-chalk-dim">
          Dark by default. System follows the setting on this device.
        </p>
        <div className="mt-3">
          <ThemeToggle value={theme} />
        </div>
      </section>

      <section className="mt-8">
        <TransferPanel />
      </section>

      <section className="mt-8">
        <h2 className="head">Where the data lives</h2>
        <p className="prose-lab text-sm text-chalk-dim">
          One SQLite file. Copy it anywhere to back the whole app up; the app can be stopped or
          running when you do.
        </p>
        <p className="verbatim mt-2 rounded border p-2" style={{ background: 'var(--ink)' }}>
          {databaseFile()}
        </p>
      </section>
    </div>
  )
}
