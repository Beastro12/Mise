import { fail, ok, parseBody } from '@/lib/api'
import { updateConceptInput } from '@/lib/validation'
import { deleteConcept, getConcept, updateConcept } from '@/lib/services/concepts'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const parsed = await parseBody(request, updateConceptInput)
  if (!parsed.ok) return parsed.response
  if (!(await getConcept(id))) return fail(404, 'That concept no longer exists.')
  const concept = await updateConcept(id, parsed.data)
  return ok({ concept })
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!(await getConcept(id))) return fail(404, 'That concept no longer exists.')
  await deleteConcept(id)
  return ok({ deleted: id })
}
