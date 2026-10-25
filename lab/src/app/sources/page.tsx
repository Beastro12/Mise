import { listModules } from '@/lib/services/courses'
import { listSources } from '@/lib/services/misc'
import { SourcesList } from '@/components/sources-list'

export const dynamic = 'force-dynamic'

export default async function SourcesPage() {
  const [sources, modules] = await Promise.all([listSources(), listModules()])

  const groups: { code: string; label: string; sources: typeof sources }[] = []

  for (const mod of modules) {
    const forModule = sources.filter((source) => source.moduleCode === mod.code)
    if (forModule.length > 0) {
      groups.push({ code: mod.code, label: `${mod.code} — ${mod.title}`, sources: forModule })
    }
  }

  const across = sources.filter((source) => source.moduleCode === 'all')
  if (across.length > 0) {
    groups.push({ code: 'all', label: 'Across all modules', sources: across })
  }

  const known = new Set(groups.flatMap((group) => group.sources.map((source) => source.id)))
  const rest = sources.filter((source) => !known.has(source.id))
  if (rest.length > 0) {
    groups.push({ code: 'current', label: 'Staying current', sources: rest })
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-chalk">Sources</h1>
      <p className="prose-lab mt-2 text-chalk-dim">
        Grouped by module. Titles and authors only — look them up yourself, so the citation is one
        you have actually seen.
      </p>

      <SourcesList groups={groups} />
    </div>
  )
}
