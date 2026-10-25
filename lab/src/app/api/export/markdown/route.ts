import { parseQuery } from '@/lib/api'
import { markdownKindInput } from '@/lib/validation'
import { exportCompletionMarkdown, exportConceptsMarkdown } from '@/lib/services/transfer'

export const dynamic = 'force-dynamic'

/** Markdown tables, ready to paste into a Claude Project. */
export async function GET(request: Request) {
  const parsed = parseQuery(request, markdownKindInput)
  if (!parsed.ok) return parsed.response

  const markdown =
    parsed.data.kind === 'concepts'
      ? await exportConceptsMarkdown()
      : await exportCompletionMarkdown()
  const date = new Date().toISOString().slice(0, 10)

  return new Response(markdown, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="lab-${parsed.data.kind}-${date}.md"`,
      'cache-control': 'no-store',
    },
  })
}
