import { describeError } from '@/lib/ai/client'
import { buildSystemPrompt, streamTutorReply, type TutorConcept } from '@/lib/ai/tutor'
import { parseBody } from '@/lib/api'
import { tutorTurnInput } from '@/lib/validation'
import { getLessonDetail } from '@/lib/services/courses'
import { listConcepts, listDueConcepts } from '@/lib/services/concepts'
import { addMessage, getSession, listMessages } from '@/lib/services/sessions'

export const dynamic = 'force-dynamic'

const asTutorConcept = (c: {
  concept: string
  establishedName: string
  myVersion: string
  whereItBreaks: string
  status: TutorConcept['status']
  nextRecallAt: string | null
}): TutorConcept => ({
  concept: c.concept,
  establishedName: c.establishedName,
  myVersion: c.myVersion,
  whereItBreaks: c.whereItBreaks,
  status: c.status,
  nextRecallAt: c.nextRecallAt,
})

/**
 * Streams one tutor reply as newline-delimited JSON events:
 *   {"type":"text","text":"…"}  repeatedly, then
 *   {"type":"done"}  or  {"type":"error","message":"…","retryable":bool}
 *
 * Both turns are persisted: the user's before the call, the reply after it
 * finishes, so a failed stream does not leave a half message in the log.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, tutorTurnInput)
  if (!parsed.ok) return parsed.response

  const session = await getSession(parsed.data.sessionId)
  if (!session) {
    return Response.json({ error: 'That session no longer exists. Start a new one.' }, { status: 404 })
  }

  await addMessage({ sessionId: session.id, role: 'user', content: parsed.data.message })

  const history = (await listMessages(session.id)).map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const detail = session.lessonId ? await getLessonDetail(session.lessonId) : null
  const [due, recent] = await Promise.all([listDueConcepts(), listConcepts()])

  let system: string
  try {
    system = await buildSystemPrompt({
      mode: session.mode,
      module: detail ? { code: detail.module.code, title: detail.module.title } : null,
      lesson: detail
        ? {
            title: detail.lesson.title,
            order: detail.lesson.order,
            objectives: detail.lesson.objectives,
            preWork: detail.lesson.preWork,
            buildExercise: detail.lesson.buildExercise,
            bridgePrompt: detail.lesson.bridgePrompt,
          }
        : null,
      dueConcepts: due.slice(0, 5).map(asTutorConcept),
      recentConcepts: recent.slice(0, 10).map(asTutorConcept),
    })
  } catch (error) {
    const described = describeError(error)
    return Response.json({ error: described.message, kind: described.kind }, { status: 503 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }
      try {
        const reply = await streamTutorReply({
          system,
          history,
          onText: (delta) => send({ type: 'text', text: delta }),
        })
        const saved = await addMessage({
          sessionId: session.id,
          role: 'assistant',
          content: reply,
        })
        send({ type: 'done', messageId: saved.id })
      } catch (error) {
        const described = describeError(error)
        send({ type: 'error', message: described.message, retryable: described.retryable })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store, no-transform',
    },
  })
}
