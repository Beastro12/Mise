import { ok, parseBody } from '@/lib/api'
import { startSessionInput } from '@/lib/validation'
import { startSession } from '@/lib/services/sessions'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const parsed = await parseBody(request, startSessionInput)
  if (!parsed.ok) return parsed.response
  const session = await startSession(parsed.data)
  return ok({ session }, 201)
}
