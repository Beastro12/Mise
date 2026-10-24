import { fail, ok, parseBody } from '@/lib/api'
import { createBuildInput } from '@/lib/validation'
import { BuildRuleError, createBuild } from '@/lib/services/learning'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const parsed = await parseBody(request, createBuildInput)
  if (!parsed.ok) return parsed.response
  try {
    const id = await createBuild(parsed.data)
    return ok({ id }, 201)
  } catch (error) {
    if (error instanceof BuildRuleError) return fail(422, error.message)
    throw error
  }
}
