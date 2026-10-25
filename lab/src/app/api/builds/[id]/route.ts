import { fail, ok, parseBody } from '@/lib/api'
import { updateBuildInput } from '@/lib/validation'
import { BuildRuleError, updateBuild } from '@/lib/services/learning'

export const dynamic = 'force-dynamic'

/** Results are refused while the prediction is empty (rules.ts). */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const parsed = await parseBody(request, updateBuildInput)
  if (!parsed.ok) return parsed.response
  try {
    const result = await updateBuild(id, parsed.data)
    return ok(result)
  } catch (error) {
    if (error instanceof BuildRuleError) {
      return fail(error.message === 'Build not found.' ? 404 : 422, error.message)
    }
    throw error
  }
}
