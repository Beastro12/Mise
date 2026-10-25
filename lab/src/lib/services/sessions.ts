import 'server-only'
import { asc, desc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { messages, sessions, type MessageRow, type SessionRow } from '@/db/schema'
import { newId } from '@/lib/ids'
import type { MessageRole, SessionMode } from '@/lib/types'
import { touchLesson } from './completion'

export async function startSession(input: {
  lessonId: string | null
  mode: SessionMode
}): Promise<SessionRow> {
  const row = {
    id: newId(),
    lessonId: input.lessonId,
    mode: input.mode,
    startedAt: new Date().toISOString(),
    endedAt: null,
    summary: null,
  }
  await db.insert(sessions).values(row)
  if (input.lessonId) await touchLesson(input.lessonId)
  return row
}

export async function getSession(id: string): Promise<SessionRow | null> {
  const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1)
  return row ?? null
}

export async function addMessage(input: {
  sessionId: string
  role: MessageRole
  content: string
}): Promise<MessageRow> {
  const row = {
    id: newId(),
    sessionId: input.sessionId,
    role: input.role,
    content: input.content,
    createdAt: new Date().toISOString(),
  }
  await db.insert(messages).values(row)
  return row
}

export async function listMessages(sessionId: string): Promise<MessageRow[]> {
  return db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(asc(messages.createdAt))
}

export async function endSession(id: string, summary: string) {
  await db
    .update(sessions)
    .set({ endedAt: new Date().toISOString(), summary })
    .where(eq(sessions.id, id))
}

export async function listSessions(limit = 50): Promise<SessionRow[]> {
  return db.select().from(sessions).orderBy(desc(sessions.startedAt)).limit(limit)
}

/** The transcript as plain text, for summaries and concept proposals. */
export async function transcriptOf(sessionId: string): Promise<string> {
  const rows = await listMessages(sessionId)
  return rows
    .map((m) => `${m.role === 'user' ? 'Pietro' : 'Tutor'}: ${m.content}`)
    .join('\n\n')
}

/** Most recent open session for a lesson, or null. */
export async function latestSessionFor(lessonId: string): Promise<SessionRow | null> {
  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.lessonId, lessonId))
    .orderBy(desc(sessions.startedAt))
    .limit(1)
  return row ?? null
}
