import { ok, parseBody } from '@/lib/api'
import { bridgeInput } from '@/lib/validation'
import { saveBridge } from '@/lib/services/learning'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const parsed = await parseBody(request, bridgeInput)
  if (!parsed.ok) return parsed.response
  const saved = await saveBridge(parsed.data)
  return ok(saved, 201)
}
