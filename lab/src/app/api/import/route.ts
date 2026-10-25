import { fail, ok, parseBody } from '@/lib/api'
import { importAll, importSchema } from '@/lib/services/transfer'

export const dynamic = 'force-dynamic'

/**
 * Replaces everything with the contents of an export file. The confirmation
 * step is in the UI; this route does the replacing.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, importSchema)
  if (!parsed.ok) return parsed.response
  try {
    const counts = await importAll(parsed.data)
    return ok({ imported: counts })
  } catch (error) {
    return fail(
      422,
      error instanceof Error
        ? error.message
        : 'The import failed and the database was left empty. Re-import a known-good export file.',
    )
  }
}
