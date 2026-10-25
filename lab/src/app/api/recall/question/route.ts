import { fail, failFromError, ok, parseBody } from '@/lib/api'
import { generateRecallQuestion } from '@/lib/ai/structured'
import { recallQuestionInput } from '@/lib/validation'
import { getConcept } from '@/lib/services/concepts'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const parsed = await parseBody(request, recallQuestionInput)
  if (!parsed.ok) return parsed.response

  const concept = await getConcept(parsed.data.conceptId)
  if (!concept) return fail(404, 'That concept no longer exists.')

  try {
    const question = await generateRecallQuestion({
      concept: concept.concept,
      establishedName: concept.establishedName,
      myVersion: concept.myVersion,
      whereItBreaks: concept.whereItBreaks,
    })
    return ok({ conceptId: concept.id, concept: concept.concept, ...question })
  } catch (error) {
    return failFromError(error)
  }
}
