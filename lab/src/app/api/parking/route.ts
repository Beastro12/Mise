import { ok, parseBody } from '@/lib/api'
import { parkInput } from '@/lib/validation'
import { listParking, park } from '@/lib/services/misc'

export const dynamic = 'force-dynamic'

export async function GET() {
  return ok({ items: await listParking() })
}

export async function POST(request: Request) {
  const parsed = await parseBody(request, parkInput)
  if (!parsed.ok) return parsed.response
  const item = await park(parsed.data)
  return ok({ item }, 201)
}
