import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { requireApiKey } from '@/lib/env'

export function anthropic(): Anthropic {
  return new Anthropic({ apiKey: requireApiKey() })
}

/**
 * Output tokens. Generous enough that thinking (on by default on the current
 * models) cannot starve the visible answer.
 */
export const MAX_TOKENS = { tutor: 16000, structured: 8192 } as const

export type FriendlyError = {
  kind: 'missing_key' | 'invalid_key' | 'rate_limit' | 'network' | 'bad_response' | 'api' | 'unknown'
  /** Shown to the user: what went wrong, and what to do about it. */
  message: string
  retryable: boolean
}

/**
 * Turns an SDK error into something the UI can show. Checked most specific
 * first, per the SDK's typed error classes.
 */
export function describeError(error: unknown): FriendlyError {
  if (error instanceof Error && error.message.includes('ANTHROPIC_API_KEY is not set')) {
    return { kind: 'missing_key', message: error.message, retryable: false }
  }
  if (error instanceof Error && /^(LAB_TUTOR_MODEL|LAB_GRADER_MODEL) is not set/.test(error.message)) {
    return { kind: 'missing_key', message: error.message, retryable: false }
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return {
      kind: 'invalid_key',
      message:
        'Anthropic rejected the API key. Check ANTHROPIC_API_KEY in .env.local, then restart the dev server.',
      retryable: false,
    }
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return {
      kind: 'invalid_key',
      message:
        'The API key does not have access to this model. Check LAB_TUTOR_MODEL and LAB_GRADER_MODEL in .env.local against the models your key can use.',
      retryable: false,
    }
  }
  if (error instanceof Anthropic.NotFoundError) {
    return {
      kind: 'api',
      message:
        'Anthropic does not recognise that model id. Check LAB_TUTOR_MODEL and LAB_GRADER_MODEL in .env.local.',
      retryable: false,
    }
  }
  if (error instanceof Anthropic.RateLimitError) {
    return {
      kind: 'rate_limit',
      message: 'Rate limited by Anthropic. Wait a moment and try again.',
      retryable: true,
    }
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return {
      kind: 'network',
      message: 'Could not reach Anthropic. Check your network connection and try again.',
      retryable: true,
    }
  }
  if (error instanceof Anthropic.APIError) {
    return {
      kind: 'api',
      message: `Anthropic returned an error (${error.status ?? 'unknown status'}): ${error.message}`,
      retryable: (error.status ?? 500) >= 500,
    }
  }
  if (error instanceof InvalidModelResponse) {
    return { kind: 'bad_response', message: error.message, retryable: true }
  }
  if (error instanceof Error) {
    return { kind: 'unknown', message: error.message, retryable: true }
  }
  return { kind: 'unknown', message: 'Something went wrong.', retryable: true }
}

/** The model answered, but not in the shape the app requires. */
export class InvalidModelResponse extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidModelResponse'
  }
}
