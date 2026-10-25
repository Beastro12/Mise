import 'server-only'
import { asc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db/client'
import {
  bridges,
  builds,
  completionEvents,
  concepts,
  explainBacks,
  lessons,
  messages,
  modules,
  parkingLot,
  recalls,
  sessions,
  sources,
} from '@/db/schema'
import { deleteAllRows } from '@/db/seed'
import {
  BRIDGE_LANGUAGES,
  BUILD_STATUSES,
  COMPLETION_ENTITY_TYPES,
  CONCEPT_STATUS_LABELS,
  CONCEPT_STATUSES,
  GRADES,
  MESSAGE_ROLES,
  MODULE_SIZES,
  PARKING_STATUSES,
  PROGRESS_STATUSES,
  READ_STATUSES,
  SESSION_MODES,
  SOURCE_KINDS,
} from '@/lib/types'
import { listCompletionEvents } from './misc'

export const EXPORT_VERSION = 1

/** Everything, in one JSON file. */
export async function exportAll() {
  const [
    moduleRows,
    lessonRows,
    conceptRows,
    sessionRows,
    messageRows,
    explainBackRows,
    buildRows,
    bridgeRows,
    recallRows,
    parkingRows,
    sourceRows,
    completionRows,
  ] = await Promise.all([
    db.select().from(modules).orderBy(asc(modules.order)),
    db.select().from(lessons).orderBy(asc(lessons.order)),
    db.select().from(concepts).orderBy(asc(concepts.createdAt)),
    db.select().from(sessions).orderBy(asc(sessions.startedAt)),
    db.select().from(messages).orderBy(asc(messages.createdAt)),
    db.select().from(explainBacks).orderBy(asc(explainBacks.createdAt)),
    db.select().from(builds).orderBy(asc(builds.createdAt)),
    db.select().from(bridges).orderBy(asc(bridges.createdAt)),
    db.select().from(recalls).orderBy(asc(recalls.createdAt)),
    db.select().from(parkingLot).orderBy(asc(parkingLot.createdAt)),
    db.select().from(sources).orderBy(asc(sources.title)),
    db.select().from(completionEvents).orderBy(asc(completionEvents.completedAt)),
  ])

  return {
    lab: 'export',
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      modules: moduleRows,
      lessons: lessonRows,
      concepts: conceptRows,
      sessions: sessionRows,
      messages: messageRows,
      explainBacks: explainBackRows,
      builds: buildRows,
      bridges: bridgeRows,
      recalls: recallRows,
      parkingLot: parkingRows,
      sources: sourceRows,
      completionEvents: completionRows,
    },
  }
}

export type LabExport = Awaited<ReturnType<typeof exportAll>>

// Import validation. Each table gets a row schema matching its columns, so a
// hand-edited or truncated file is rejected with a specific message instead of
// writing nonsense into the database.

const iso = z.string().min(1)
const isoOrNull = z.string().nullable().default(null)
const str = z.string()
const strDefault = z.string().default('')

const moduleRowSchema = z.object({
  id: iso,
  code: str.min(1),
  title: str,
  summary: strDefault,
  order: z.number().int(),
  size: z.enum(MODULE_SIZES),
  status: z.enum(PROGRESS_STATUSES),
  completedAt: isoOrNull,
})

const lessonRowSchema = z.object({
  id: iso,
  moduleId: iso,
  order: z.number().int(),
  title: str,
  objectives: strDefault,
  preWork: strDefault,
  buildExercise: z.string().nullable().default(null),
  bridgePrompt: strDefault,
  status: z.enum(PROGRESS_STATUSES),
  preWorkDoneAt: isoOrNull,
  completedAt: isoOrNull,
})

const conceptRowSchema = z.object({
  id: iso,
  concept: str.min(1),
  establishedName: strDefault,
  myVersion: strDefault,
  whereItBreaks: strDefault,
  buildLink: strDefault,
  status: z.enum(CONCEPT_STATUSES),
  lessonId: z.string().nullable().default(null),
  createdAt: iso,
  updatedAt: iso,
  recallBox: z.number().int().min(0).max(5),
  nextRecallAt: isoOrNull,
  lastRecalledAt: isoOrNull,
})

const sessionRowSchema = z.object({
  id: iso,
  lessonId: z.string().nullable().default(null),
  mode: z.enum(SESSION_MODES),
  startedAt: iso,
  endedAt: isoOrNull,
  summary: z.string().nullable().default(null),
})

const messageRowSchema = z.object({
  id: iso,
  sessionId: iso,
  role: z.enum(MESSAGE_ROLES),
  content: str,
  createdAt: iso,
})

const explainBackRowSchema = z.object({
  id: iso,
  lessonId: iso,
  conceptId: z.string().nullable().default(null),
  prompt: str,
  answer: str,
  grade: z.enum(GRADES),
  feedback: strDefault,
  missingPieces: strDefault,
  createdAt: iso,
})

const buildRowSchema = z.object({
  id: iso,
  lessonId: iso,
  title: str,
  prediction: strDefault,
  results: strDefault,
  comparison: strDefault,
  status: z.enum(BUILD_STATUSES),
  conceptId: z.string().nullable().default(null),
  createdAt: iso,
  completedAt: isoOrNull,
})

const bridgeRowSchema = z.object({
  id: iso,
  lessonId: iso,
  text: str,
  language: z.enum(BRIDGE_LANGUAGES),
  createdAt: iso,
})

const recallRowSchema = z.object({
  id: iso,
  conceptId: iso,
  question: str,
  answer: str,
  grade: z.enum(GRADES),
  moduleCheckRunId: z.string().nullable().default(null),
  createdAt: iso,
})

const parkingRowSchema = z.object({
  id: iso,
  text: str,
  source: strDefault,
  status: z.enum(PARKING_STATUSES),
  createdAt: iso,
})

const sourceRowSchema = z.object({
  id: iso,
  title: str.min(1),
  author: strDefault,
  moduleCode: strDefault,
  kind: z.enum(SOURCE_KINDS),
  note: strDefault,
  readStatus: z.enum(READ_STATUSES),
})

const completionRowSchema = z.object({
  id: iso,
  entityType: z.enum(COMPLETION_ENTITY_TYPES),
  entityId: iso,
  evidence: str,
  completedAt: iso,
})

export const importSchema = z.object({
  lab: z.literal('export'),
  version: z.number().int().positive(),
  exportedAt: z.string().optional(),
  data: z.object({
    modules: z.array(moduleRowSchema),
    lessons: z.array(lessonRowSchema),
    concepts: z.array(conceptRowSchema),
    sessions: z.array(sessionRowSchema),
    messages: z.array(messageRowSchema),
    explainBacks: z.array(explainBackRowSchema),
    builds: z.array(buildRowSchema),
    bridges: z.array(bridgeRowSchema),
    recalls: z.array(recallRowSchema),
    parkingLot: z.array(parkingRowSchema),
    sources: z.array(sourceRowSchema),
    completionEvents: z.array(completionRowSchema),
  }),
})

export type LabImport = z.infer<typeof importSchema>

/** Replaces the whole database with the contents of an export file. */
export async function importAll(payload: LabImport) {
  if (payload.version > EXPORT_VERSION) {
    throw new Error(
      `This file was written by a newer version of Lab (version ${payload.version}; this app reads version ${EXPORT_VERSION}).`,
    )
  }

  const d = payload.data
  await deleteAllRows(db)

  // Parents before children, so the foreign keys resolve.
  if (d.modules.length) await db.insert(modules).values(d.modules)
  if (d.lessons.length) await db.insert(lessons).values(d.lessons)
  if (d.concepts.length) await db.insert(concepts).values(d.concepts)
  if (d.sessions.length) await db.insert(sessions).values(d.sessions)
  if (d.messages.length) await db.insert(messages).values(d.messages)
  if (d.explainBacks.length) await db.insert(explainBacks).values(d.explainBacks)
  if (d.builds.length) await db.insert(builds).values(d.builds)
  if (d.bridges.length) await db.insert(bridges).values(d.bridges)
  if (d.recalls.length) await db.insert(recalls).values(d.recalls)
  if (d.parkingLot.length) await db.insert(parkingLot).values(d.parkingLot)
  if (d.sources.length) await db.insert(sources).values(d.sources)
  if (d.completionEvents.length)
    await db.insert(completionEvents).values(d.completionEvents)

  return {
    modules: d.modules.length,
    lessons: d.lessons.length,
    concepts: d.concepts.length,
    sessions: d.sessions.length,
    messages: d.messages.length,
    explainBacks: d.explainBacks.length,
    builds: d.builds.length,
    bridges: d.bridges.length,
    recalls: d.recalls.length,
    parkingLot: d.parkingLot.length,
    sources: d.sources.length,
    completionEvents: d.completionEvents.length,
  }
}

// ---------------------------------------------------------------------------
// Markdown exports, for pasting back into a Claude Project
// ---------------------------------------------------------------------------

function cell(value: string | null | undefined): string {
  return (value ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim() || '—'
}

function day(iso: string | null | undefined): string {
  if (!iso) return '—'
  return iso.slice(0, 10)
}

/** Column order is fixed by the brief; do not reorder. */
export async function exportConceptsMarkdown(): Promise<string> {
  const rows = await db.select().from(concepts).orderBy(asc(concepts.createdAt))
  const header = [
    '| Concept | Established name / source | My 1-line version | Where it breaks | Build link | Status | Date |',
    '|---|---|---|---|---|---|---|',
  ]
  const body = rows.map(
    (c) =>
      '| ' +
      [
        cell(c.concept),
        cell(c.establishedName),
        cell(c.myVersion),
        cell(c.whereItBreaks),
        cell(c.buildLink),
        CONCEPT_STATUS_LABELS[c.status],
        day(c.updatedAt ?? c.createdAt),
      ].join(' | ') +
      ' |',
  )
  return ['# Concept register', '', ...header, ...body, ''].join('\n')
}

export async function exportCompletionMarkdown(): Promise<string> {
  const entries = await listCompletionEvents()
  const header = [
    '| Completed | Type | Module | What | Evidence |',
    '|---|---|---|---|---|',
  ]
  const body = entries.map((e) => {
    const evidence = [
      e.evidence.explainBackIds.length > 0
        ? `${e.evidence.explainBackIds.length} explain-back(s)`
        : null,
      e.evidence.buildId ? 'build' : null,
      e.evidence.bridgeId ? 'bridge' : null,
      e.evidence.recallIds && e.evidence.recallIds.length > 0
        ? `${e.evidence.recallIds.length} recall answer(s)`
        : null,
    ]
      .filter(Boolean)
      .join(', ')
    return `| ${day(e.completedAt)} | ${e.entityType} | ${cell(e.moduleCode)} | ${cell(e.title)} | ${cell(evidence)} |`
  })
  return ['# Completion register', '', ...header, ...body, ''].join('\n')
}
