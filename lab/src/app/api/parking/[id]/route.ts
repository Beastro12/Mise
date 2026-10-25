import { ok, parseBody } from '@/lib/api'
import { parkingStatusInput } from '@/lib/validation'
import { setParkingStatus } from '@/lib/services/misc'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const parsed = await parseBody(request, parkingStatusInput)
  if (!parsed.ok) return parsed.response
  await setParkingStatus(id, parsed.data.status)
  return ok({ id, status: parsed.data.status })
}
