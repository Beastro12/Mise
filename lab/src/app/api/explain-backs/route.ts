import { failFromError, ok, parseBody } from '@/lib/api'
import { gradeExplainBack } from '@/lib/ai/structured'
import { explainBackInput } from '@/lib/validation'
import { getLessonDetail } from '@/lib/services/courses'
import { getConcept } from '@/lib/services/concepts'
import { saveExplainBack } from '@/lib/services/learning'

export const dynamic = 'force-dynamic'

/** Grades an explain-back, saves it, and re-checks lesson completion. */
export async function POST(request: Request) {
  const parsed = await parseBody(request, explainBackInput)
  if (!parsed.ok) return parsed.response

  const detail = await getLessonDetail(parsed.data.lessonId)
  if (!detail) return ok({ error: 'That lesson no longer exists.' }, 404)

  const concept = parsed.data.conceptId ? await getConcept(parsed.data.conceptId) : null

  try {
    const graded = await gradeExplainBack({
      concept: concept?.concept ?? '',
      lessonObjectives: detail.lesson.objectives,
      prompt: parsed.data.prompt,
      answer: parsed.data.answer,
    })

    const saved = await saveExplainBack({
      lessonId: parsed.data.lessonId,
      conceptId: parsed.data.conceptId,
      prompt: parsed.data.prompt,
      answer: parsed.data.answer,
      grade: graded.grade,
      feedback: graded.feedback,
      missingPieces: graded.missingPieces,
    })

    return ok({
      id: saved.id,
      grade: graded.grade,
      feedback: graded.feedback,
      missingPieces: graded.missingPieces,
      completion: saved.completion,
    })
  } catch (error) {
    return failFromError(error)
  }
}
