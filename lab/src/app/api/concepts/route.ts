import { ok, parseBody } from '@/lib/api'
import { createConceptInput } from '@/lib/validation'
import { createConcept, listConcepts } from '@/lib/services/concepts'

export const dynamic = 'force-dynamic'

export async function GET() {
  return ok({ concepts: await listConcepts() })
}

export async function POST(request: Request) {
  const parsed = await parseBody(request, createConceptInput)
  if (!parsed.ok) return parsed.response
  const concept = await createConcept(parsed.data)
  return ok({ concept }, 201)
}
