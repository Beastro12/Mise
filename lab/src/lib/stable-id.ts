import { createHash } from 'node:crypto'

/**
 * A text UUID derived from a stable natural key (a module code, a concept
 * name). Seeding uses these so `npm run db:setup` can run any number of times
 * without inserting a second copy of the same row. Everything created at
 * runtime uses a random UUID instead.
 *
 * Shaped as a UUID v5 (SHA-1 based, RFC 4122 variant bits).
 */
export function stableId(kind: string, key: string): string {
  const hex = createHash('sha1').update(`lab:${kind}:${key}`).digest('hex')
  const version = ((parseInt(hex.slice(12, 13), 16) & 0x3) | 0x5).toString(16)
  const variant = ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16)
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    version + hex.slice(13, 16),
    variant + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-')
}
