import { z } from 'zod'
import { describeError } from '@/lib/ai/client'

export function ok<T>(data: T, status = 200): Response {
  return Response.json(data, { status })
}

/** Every failure says what went wrong, in words the UI shows as-is. */
export function fail(status: number, message: string, extra?: Record<string, unknown>): Response {
  return Response.json({ error: message, ...extra }, { status })
}

/** Maps an SDK or rules error onto a status and a specific message. */
export function failFromError(error: unknown): Response {
  const described = describeError(error)
  const status =
    described.kind === 'missing_key' || described.kind === 'invalid_key'
      ? 503
      : described.kind === 'rate_limit'
        ? 429
        : described.kind === 'network'
          ? 504
          : described.kind === 'bad_response'
            ? 502
            : 500
  return fail(status, described.message, { kind: described.kind, retryable: described.retryable })
}

type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response }

/** Validates a JSON body against a zod schema. */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<Parsed<T>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return {
      ok: false,
      response: fail(400, 'The request body was not valid JSON.'),
    }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ')
    return {
      ok: false,
      response: fail(400, `The request was not valid: ${details}`),
    }
  }
  return { ok: true, data: result.data }
}

/** Validates search params against a zod schema. */
export function parseQuery<T>(request: Request, schema: z.ZodType<T>): Parsed<T> {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries())
  const result = schema.safeParse(params)
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'query'}: ${issue.message}`)
      .join('; ')
    return { ok: false, response: fail(400, `The request was not valid: ${details}`) }
  }
  return { ok: true, data: result.data }
}

export const idSchema = z.string().min(1, 'an id is required')
export const nonEmpty = (field: string) => z.string().trim().min(1, `${field} cannot be empty`)
