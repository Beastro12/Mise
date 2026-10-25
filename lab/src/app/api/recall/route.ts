import { fail, failFromError, ok, parseBody } from '@/lib/api'
import { gradeRecall } from '@/lib/ai/structured'
import { recallAnswerInput } from '@/lib/validation'
import { getConcept, recordRecall } from '@/lib/services/concepts'
import { refreshModule } from '@/lib/services/completion'
import { db } from '@/db/client'
import { lessons } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/** Grades one recall answer, records it, and advances the Leitner schedule. */
export async function POST(request: Request) {
  const parsed = await parseBody(request, recallAnswerInput)
  if (!parsed.ok) return parsed.response

  const concept = await getConcept(parsed.data.conceptId)
  if (!concept) return fail(404, 'That concept no longer exists.')

  try {
    const graded = await gradeRecall({
      question: parsed.data.question,
      expected: parsed.data.expectedAnswer,
      answer: parsed.data.answer,
    })

    const { schedule } = await recordRecall({
      conceptId: concept.id,
      question: parsed.data.question,
      answer: parsed.data.answer,
      grade: graded.grade,
      moduleCheckRunId: parsed.data.moduleCheckRunId,
    })

    // A module check answer can complete a module.
    if (parsed.data.moduleCheckRunId && concept.lessonId) {
      const [lesson] = await db
        .select()
        .from(lessons)
        .where(eq(lessons.id, concept.lessonId))
        .limit(1)
      if (lesson) await refreshModule(lesson.moduleId)
    }

    return ok({
      grade: graded.grade,
      feedback: graded.feedback,
      missingPieces: graded.missingPieces,
      expectedAnswer: parsed.data.expectedAnswer,
      recallBox: schedule.recallBox,
      nextRecallAt: schedule.nextRecallAt,
    })
  } catch (error) {
    return failFromError(error)
  }
}
