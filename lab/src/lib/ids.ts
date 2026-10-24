import { randomUUID } from 'node:crypto'

/** Text UUID, used for every primary key. */
export function newId(): string {
  return randomUUID()
}
