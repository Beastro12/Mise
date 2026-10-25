import { migrate } from 'drizzle-orm/libsql/migrator'
import { eq } from 'drizzle-orm'
import { join } from 'node:path'
import type { LabDb } from './connect'
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
} from './schema'
import {
  PLACEMENT_SESSION,
  SEED_CONCEPTS,
  SEED_EXPLAIN_BACKS,
  SEED_MODULES,
  SEED_PARKING,
  SEED_SOURCES,
  conceptId,
  lessonId,
  moduleId,
  sourceId,
} from './seed-data'
import { stableId } from '../lib/stable-id'
import { isScheduledForRecall } from '../lib/rules'

export type SeedCounts = Record<string, number>

export async function runMigrations(db: LabDb, migrationsFolder?: string) {
  await migrate(db, {
    migrationsFolder: migrationsFolder ?? join(process.cwd(), 'drizzle'),
  })
}

/**
 * Inserts the seed content. Idempotent: every row has an id derived from a
 * stable natural key and every insert is onConflictDoNothing, so a second run
 * inserts nothing and never touches a row that has since been edited.
 */
export async function seed(db: LabDb): Promise<SeedCounts> {
  const counts: SeedCounts = {}
  const bump = (key: string, n: number) => {
    counts[key] = (counts[key] ?? 0) + n
  }

  for (const mod of SEED_MODULES) {
    const inserted = await db
      .insert(modules)
      .values({
        id: moduleId(mod.code),
        code: mod.code,
        title: mod.title,
        summary: mod.summary,
        order: mod.order,
        size: mod.size,
        status: mod.status ?? 'not_started',
        completedAt: null,
      })
      .onConflictDoNothing()
    bump('modules', Number(inserted.rowsAffected ?? 0))

    for (const lesson of mod.lessons) {
      const res = await db
        .insert(lessons)
        .values({
          id: lessonId(mod.code, lesson.order),
          moduleId: moduleId(mod.code),
          order: lesson.order,
          title: lesson.title,
          objectives: lesson.objectives,
          preWork: lesson.preWork,
          buildExercise: lesson.buildExercise,
          bridgePrompt: lesson.bridgePrompt,
          status: lesson.status ?? 'not_started',
          completedAt: null,
        })
        .onConflictDoNothing()
      bump('lessons', Number(res.rowsAffected ?? 0))
    }
  }

  for (const c of SEED_CONCEPTS) {
    const scheduled = isScheduledForRecall(c.status)
    const res = await db
      .insert(concepts)
      .values({
        id: conceptId(c.concept),
        concept: c.concept,
        establishedName: c.establishedName,
        myVersion: c.myVersion,
        whereItBreaks: c.whereItBreaks,
        buildLink: c.buildLink,
        status: c.status,
        lessonId: c.lesson ? lessonId(c.lesson.code, c.lesson.order) : null,
        createdAt: c.createdAt,
        updatedAt: c.createdAt,
        recallBox: c.recallBox ?? 0,
        nextRecallAt: scheduled ? (c.nextRecallAt ?? null) : null,
        lastRecalledAt: null,
      })
      .onConflictDoNothing()
    bump('concepts', Number(res.rowsAffected ?? 0))
  }

  const placementId = stableId('session', PLACEMENT_SESSION.key)
  const placement = await db
    .insert(sessions)
    .values({
      id: placementId,
      lessonId: null,
      mode: PLACEMENT_SESSION.mode,
      startedAt: PLACEMENT_SESSION.startedAt,
      endedAt: PLACEMENT_SESSION.endedAt,
      summary: PLACEMENT_SESSION.summary,
    })
    .onConflictDoNothing()
  bump('sessions', Number(placement.rowsAffected ?? 0))

  for (const eb of SEED_EXPLAIN_BACKS) {
    const res = await db
      .insert(explainBacks)
      .values({
        id: stableId('explainBack', eb.key),
        lessonId: lessonId(eb.lesson.code, eb.lesson.order),
        conceptId: conceptId(eb.concept),
        prompt: eb.prompt,
        answer: eb.answer,
        grade: eb.grade,
        feedback: eb.feedback,
        missingPieces: eb.missingPieces,
        createdAt: eb.createdAt,
      })
      .onConflictDoNothing()
    bump('explainBacks', Number(res.rowsAffected ?? 0))
  }

  for (const p of SEED_PARKING) {
    const res = await db
      .insert(parkingLot)
      .values({
        id: stableId('parking', p.key),
        text: p.text,
        source: 'manual',
        status: 'open',
        createdAt: p.createdAt,
      })
      .onConflictDoNothing()
    bump('parkingLot', Number(res.rowsAffected ?? 0))
  }

  for (const s of SEED_SOURCES) {
    const res = await db
      .insert(sources)
      .values({
        id: sourceId(s.title),
        title: s.title,
        author: s.author,
        moduleCode: s.moduleCode,
        kind: s.kind,
        note: s.note,
        readStatus: s.readStatus ?? 'unread',
      })
      .onConflictDoNothing()
    bump('sources', Number(res.rowsAffected ?? 0))
  }

  return counts
}

/** Row counts per table, for the setup script's report. */
export async function tableCounts(db: LabDb) {
  const tables = {
    modules,
    lessons,
    concepts,
    sessions,
    messages,
    explainBacks,
    builds,
    bridges,
    recalls,
    parkingLot,
    sources,
    completionEvents,
  }
  const out: SeedCounts = {}
  for (const [name, table] of Object.entries(tables)) {
    const rows = await db.select().from(table)
    out[name] = rows.length
  }
  return out
}

/** Used by the import route to replace the whole database contents. */
export async function deleteAllRows(db: LabDb) {
  await db.delete(completionEvents)
  await db.delete(recalls)
  await db.delete(bridges)
  await db.delete(builds)
  await db.delete(explainBacks)
  await db.delete(messages)
  await db.delete(sessions)
  await db.delete(concepts)
  await db.delete(lessons)
  await db.delete(modules)
  await db.delete(parkingLot)
  await db.delete(sources)
}

/** True when a module code already exists (used by tests and the importer). */
export async function moduleExists(db: LabDb, code: string) {
  const found = await db.select().from(modules).where(eq(modules.code, code)).limit(1)
  return found.length > 0
}
