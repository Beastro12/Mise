import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

// All timestamps are ISO-8601 strings in UTC. All ids are text UUIDs.
// SQLite has no enum type, so statuses are text columns with the allowed
// values enforced by the $type<> annotation here and by zod at every entry
// point (API routes, seed, import).

import {
  type ModuleSize,
  type ProgressStatus,
  type ConceptStatus,
  type SessionMode,
  type MessageRole,
  type Grade,
  type BuildStatus,
  type BridgeLanguage,
  type ParkingStatus,
  type SourceKind,
  type ReadStatus,
  type CompletionEntityType,
} from '../lib/types'

export * from '../lib/types'

export const modules = sqliteTable('modules', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  // "order" is a SQL keyword; the column is order_index (DECISIONS D4).
  order: integer('order_index').notNull(),
  size: text('size').$type<ModuleSize>().notNull(),
  status: text('status').$type<ProgressStatus>().notNull().default('not_started'),
  completedAt: text('completed_at'),
})

export const lessons = sqliteTable(
  'lessons',
  {
    id: text('id').primaryKey(),
    moduleId: text('module_id')
      .notNull()
      .references(() => modules.id, { onDelete: 'cascade' }),
    order: integer('order_index').notNull(),
    title: text('title').notNull(),
    objectives: text('objectives').notNull(),
    preWork: text('pre_work').notNull(),
    buildExercise: text('build_exercise'),
    bridgePrompt: text('bridge_prompt').notNull(),
    status: text('status').$type<ProgressStatus>().notNull().default('not_started'),
    // Pre-work is a loop-state marker, not one of the three completion
    // requirements, so it is set by hand here (DECISIONS D6).
    preWorkDoneAt: text('pre_work_done_at'),
    completedAt: text('completed_at'),
  },
  (t) => [index('lessons_module_idx').on(t.moduleId)],
)

export const concepts = sqliteTable(
  'concepts',
  {
    id: text('id').primaryKey(),
    concept: text('concept').notNull(),
    establishedName: text('established_name').notNull().default(''),
    myVersion: text('my_version').notNull().default(''),
    whereItBreaks: text('where_it_breaks').notNull().default(''),
    buildLink: text('build_link').notNull().default(''),
    status: text('status').$type<ConceptStatus>().notNull().default('met'),
    lessonId: text('lesson_id').references(() => lessons.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    recallBox: integer('recall_box').notNull().default(0),
    nextRecallAt: text('next_recall_at'),
    lastRecalledAt: text('last_recalled_at'),
  },
  (t) => [index('concepts_next_recall_idx').on(t.nextRecallAt)],
)

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    lessonId: text('lesson_id').references(() => lessons.id, { onDelete: 'set null' }),
    mode: text('mode').$type<SessionMode>().notNull(),
    startedAt: text('started_at').notNull(),
    endedAt: text('ended_at'),
    summary: text('summary'),
  },
  (t) => [index('sessions_lesson_idx').on(t.lessonId)],
)

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    role: text('role').$type<MessageRole>().notNull(),
    content: text('content').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('messages_session_idx').on(t.sessionId)],
)

export const explainBacks = sqliteTable(
  'explain_backs',
  {
    id: text('id').primaryKey(),
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    conceptId: text('concept_id').references(() => concepts.id, { onDelete: 'set null' }),
    prompt: text('prompt').notNull(),
    answer: text('answer').notNull(),
    grade: text('grade').$type<Grade>().notNull(),
    feedback: text('feedback').notNull(),
    missingPieces: text('missing_pieces').notNull().default(''),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('explain_backs_lesson_idx').on(t.lessonId)],
)

export const builds = sqliteTable(
  'builds',
  {
    id: text('id').primaryKey(),
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    // Required before results can be saved (rules.ts: canSaveResults).
    prediction: text('prediction').notNull().default(''),
    results: text('results').notNull().default(''),
    comparison: text('comparison').notNull().default(''),
    status: text('status').$type<BuildStatus>().notNull().default('planned'),
    conceptId: text('concept_id').references(() => concepts.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull(),
    completedAt: text('completed_at'),
  },
  (t) => [index('builds_lesson_idx').on(t.lessonId)],
)

export const bridges = sqliteTable(
  'bridges',
  {
    id: text('id').primaryKey(),
    lessonId: text('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    language: text('language').$type<BridgeLanguage>().notNull().default('en'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('bridges_lesson_idx').on(t.lessonId)],
)

export const recalls = sqliteTable(
  'recalls',
  {
    id: text('id').primaryKey(),
    conceptId: text('concept_id')
      .notNull()
      .references(() => concepts.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    grade: text('grade').$type<Grade>().notNull(),
    // Set when this answer was part of a module check run; null for a single
    // due card. Lets a passed module check be re-derived later (DECISIONS D5).
    moduleCheckRunId: text('module_check_run_id'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('recalls_concept_idx').on(t.conceptId),
    index('recalls_run_idx').on(t.moduleCheckRunId),
  ],
)

export const parkingLot = sqliteTable('parking_lot', {
  id: text('id').primaryKey(),
  text: text('text').notNull(),
  // A session id, or the literal "manual".
  source: text('source').notNull().default('manual'),
  status: text('status').$type<ParkingStatus>().notNull().default('open'),
  createdAt: text('created_at').notNull(),
})

export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  author: text('author').notNull().default(''),
  // A module code (M0, M1, …), the AI Act code, or "—" for staying current.
  moduleCode: text('module_code').notNull().default('—'),
  kind: text('kind').$type<SourceKind>().notNull(),
  note: text('note').notNull().default(''),
  readStatus: text('read_status').$type<ReadStatus>().notNull().default('unread'),
})

export const completionEvents = sqliteTable(
  'completion_events',
  {
    id: text('id').primaryKey(),
    entityType: text('entity_type').$type<CompletionEntityType>().notNull(),
    entityId: text('entity_id').notNull(),
    // JSON: { explainBackIds: string[], buildId: string | null,
    //         bridgeId: string | null, recallIds?: string[], lessonIds?: string[] }
    evidence: text('evidence').notNull(),
    completedAt: text('completed_at').notNull(),
  },
  (t) => [index('completion_entity_idx').on(t.entityType, t.entityId)],
)

export type ModuleRow = typeof modules.$inferSelect
export type LessonRow = typeof lessons.$inferSelect
export type ConceptRow = typeof concepts.$inferSelect
export type SessionRow = typeof sessions.$inferSelect
export type MessageRow = typeof messages.$inferSelect
export type ExplainBackRow = typeof explainBacks.$inferSelect
export type BuildRow = typeof builds.$inferSelect
export type BridgeRow = typeof bridges.$inferSelect
export type RecallRow = typeof recalls.$inferSelect
export type ParkingRow = typeof parkingLot.$inferSelect
export type SourceRow = typeof sources.$inferSelect
export type CompletionEventRow = typeof completionEvents.$inferSelect
