import { fail, failFromError, ok, parseBody } from '@/lib/api'
import { generateRecallQuestion } from '@/lib/ai/structured'
import { newId } from '@/lib/ids'
import { MODULE_CHECK_QUESTIONS } from '@/lib/rules'
import { moduleCheckInput } from '@/lib/validation'
import { conceptsForModuleLessons } from '@/lib/services/concepts'
import { getModuleDetail } from '@/lib/services/courses'

export const dynamic = 'force-dynamic'

/**
 * Starts a module check: one run id plus four questions drawn from concepts
 * linked to the module's lessons. Answers are graded through /api/recall with
 * the run id attached, which is what makes the run countable.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, moduleCheckInput)
  if (!parsed.ok) return parsed.response

  const detail = await getModuleDetail(parsed.data.moduleId)
  if (!detail) return fail(404, 'That module no longer exists.')

  const candidates = await conceptsForModuleLessons(detail.lessons.map((l) => l.id))
  if (candidates.length === 0) {
    return fail(
      422,
      'No concepts are linked to this module’s lessons yet. Add concepts to the register and link them to a lesson first.',
    )
  }

  // Least recently recalled first, so a check does not ask the same four.
  const ordered = [...candidates].sort((a, b) =>
    (a.lastRecalledAt ?? '').localeCompare(b.lastRecalledAt ?? ''),
  )
  const chosen: typeof ordered = []
  for (let i = 0; i < MODULE_CHECK_QUESTIONS; i++) {
    const pick = ordered[i % ordered.length]
    if (pick) chosen.push(pick)
  }

  try {
    const questions = await Promise.all(
      chosen.map(async (concept) => ({
        conceptId: concept.id,
        concept: concept.concept,
        ...(await generateRecallQuestion({
          concept: concept.concept,
          establishedName: concept.establishedName,
          myVersion: concept.myVersion,
          whereItBreaks: concept.whereItBreaks,
        })),
      })),
    )
    return ok({ runId: newId(), moduleId: detail.module.id, questions })
  } catch (error) {
    return failFromError(error)
  }
}
