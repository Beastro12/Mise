import { ok, parseBody } from '@/lib/api'
import { preWorkInput } from '@/lib/validation'
import { setPreWorkDone } from '@/lib/services/learning'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const parsed = await parseBody(request, preWorkInput)
  if (!parsed.ok) return parsed.response
  await setPreWorkDone(id, parsed.data.done)
  return ok({ id, done: parsed.data.done })
}
