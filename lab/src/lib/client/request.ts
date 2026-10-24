'use client'

/**
 * One place for calling the API from a client component. Every route answers
 * with { error } on failure, so the message shown to the user is the server's
 * own words rather than a generic "something went wrong".
 */
export async function apiRequest<T>(
  url: string,
  options: { method?: string; body?: unknown } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string; retryable: boolean }> {
  try {
    const response = await fetch(url, {
      method: options.method ?? 'POST',
      headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })

    const text = await response.text()
    let payload: unknown = null
    if (text.length > 0) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = null
      }
    }

    if (!response.ok) {
      const record = (payload ?? {}) as { error?: string; retryable?: boolean }
      return {
        ok: false,
        error:
          record.error ??
          `The request failed (${response.status}). Check the terminal running npm run dev for the full error.`,
        retryable: record.retryable ?? response.status >= 500,
      }
    }

    return { ok: true, data: payload as T }
  } catch {
    return {
      ok: false,
      error: 'Could not reach the app. Is npm run dev still running?',
      retryable: true,
    }
  }
}
