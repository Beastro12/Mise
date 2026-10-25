import { failFromError, ok } from '@/lib/api'
import { proposeConceptRows, summarizeSession } from '@/lib/ai/structured'
import { endSession, getSession, transcriptOf } from '@/lib/services/sessions'

export const dynamic = 'force-dynamic'

/**
 * Ends a session: writes a 3-5 sentence summary and returns proposed concept
 * rows. The proposals are never inserted here — the user accepts, edits or
 * rejects them on the lesson page.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const session = await getSession(id)
  if (!session) return ok({ error: 'That session no longer exists.' }, 404)

  const transcript = await transcriptOf(id)
  if (transcript.trim().length === 0) {
    await endSession(id, 'Session ended with no messages.')
    return ok({ summary: 'Session ended with no messages.', proposals: [] })
  }

  try {
    const [summary, proposals] = await Promise.all([
      summarizeSession(transcript),
      proposeConceptRows(transcript),
    ])
    await endSession(id, summary)
    return ok({ summary, proposals })
  } catch (error) {
    return failFromError(error)
  }
}
