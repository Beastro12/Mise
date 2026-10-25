import { ok, parseBody } from '@/lib/api'
import { sourceStatusInput } from '@/lib/validation'
import { setSourceReadStatus } from '@/lib/services/misc'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const parsed = await parseBody(request, sourceStatusInput)
  if (!parsed.ok) return parsed.response
  await setSourceReadStatus(id, parsed.data.readStatus)
  return ok({ id, readStatus: parsed.data.readStatus })
}
