import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The database path is read when src/db/client.ts is first imported, so it is
// set before anything else loads.
const dir = mkdtempSync(join(tmpdir(), 'lab-test-'))
process.env.LAB_DB_FILE = join(dir, 'lab.db')

type Services = {
  seed: typeof import('@/db/seed')
  connect: typeof import('@/db/connect')
  concepts: typeof import('@/lib/services/concepts')
  learning: typeof import('@/lib/services/learning')
  completion: typeof import('@/lib/services/completion')
  misc: typeof import('@/lib/services/misc')
  transfer: typeof import('@/lib/services/transfer')
  client: typeof import('@/db/client')
  schema: typeof import('@/db/schema')
}

let s: Services

beforeAll(async () => {
  s = {
    seed: await import('@/db/seed'),
    connect: await import('@/db/connect'),
    concepts: await import('@/lib/services/concepts'),
    learning: await import('@/lib/services/learning'),
    completion: await import('@/lib/services/completion'),
    misc: await import('@/lib/services/misc'),
    transfer: await import('@/lib/services/transfer'),
    client: await import('@/db/client'),
    schema: await import('@/db/schema'),
  }
  await s.seed.runMigrations(s.client.db, join(process.cwd(), 'drizzle'))
  await s.seed.seed(s.client.db)
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

async function firstLesson() {
  const { asc } = await import('drizzle-orm')
  const rows = await s.client.db
    .select()
    .from(s.schema.lessons)
    .orderBy(asc(s.schema.lessons.order))
  const lesson = rows[0]
  if (!lesson) throw new Error('seed did not create lessons')
  return lesson
}

describe('seeding', () => {
  it('creates the course, register, placement session and library', async () => {
    const counts = await s.seed.tableCounts(s.client.db)
    expect(counts.modules).toBe(8)
    expect(counts.lessons).toBe(22)
    expect(counts.concepts).toBe(16)
    expect(counts.sources).toBe(19)
    expect(counts.parkingLot).toBe(2)
    expect(counts.explainBacks).toBe(2)
    expect(counts.sessions).toBe(1)
  })

  it('is idempotent: a second run inserts nothing', async () => {
    const inserted = await s.seed.seed(s.client.db)
    expect(Object.values(inserted).reduce((a, b) => a + b, 0)).toBe(0)
  })

  it('schedules the one partially explained concept and nothing at met', async () => {
    const all = await s.concepts.listConcepts()
    const scheduled = all.filter((c) => c.nextRecallAt !== null)
    expect(scheduled).toHaveLength(1)
    expect(scheduled[0]?.concept).toBe('Training without understanding')
    expect(all.filter((c) => c.status === 'met').every((c) => c.nextRecallAt === null)).toBe(true)
  })
})

describe('a lesson being completed', () => {
  it('promotes the concept, records the evidence and closes the lesson', async () => {
    const lesson = await firstLesson()
    const linked = (await s.concepts.listConcepts()).find((c) => c.lessonId === lesson.id)
    expect(linked?.status).toBe('met')
    expect(linked?.nextRecallAt).toBeNull()

    // A partial first: promotes met -> explained_back_partial and starts the
    // recall schedule, and does not complete the lesson.
    const partial = await s.learning.saveExplainBack({
      lessonId: lesson.id,
      conceptId: linked?.id ?? null,
      prompt: 'How does it work?',
      answer: 'It predicts the next token.',
      grade: 'partial',
      feedback: 'Names it without the mechanism.',
      missingPieces: 'Sampling.',
    })
    expect(partial.completion.complete).toBe(false)

    const afterPartial = await s.concepts.getConcept(linked?.id ?? '')
    expect(afterPartial?.status).toBe('explained_back_partial')
    expect(afterPartial?.nextRecallAt).not.toBeNull()

    // The build: results are refused until a prediction exists.
    const buildId = await s.learning.createBuild({
      lessonId: lesson.id,
      title: 'Five fresh chats',
      prediction: 'Two of five will differ.',
      conceptId: linked?.id ?? null,
    })
    await expect(
      s.learning.updateBuild(buildId, { prediction: '', results: 'sneaking results in' }),
    ).rejects.toThrow(/Save a prediction before the results/)

    // Finishing the build promotes the concept to applied.
    await s.learning.updateBuild(buildId, {
      results: 'Four of five differed.',
      comparison: 'I underestimated sampling variance.',
    })
    expect((await s.concepts.getConcept(linked?.id ?? ''))?.status).toBe('applied')

    // A full explain-back, then a bridge, closes the lesson.
    await s.learning.saveExplainBack({
      lessonId: lesson.id,
      conceptId: linked?.id ?? null,
      prompt: 'How does it work?',
      answer: 'Knowledge is compressed into the weights; there is no lookup table.',
      grade: 'full',
      feedback: 'Correct mechanism.',
      missingPieces: '',
    })
    const bridge = await s.learning.saveBridge({
      lessonId: lesson.id,
      text: 'A model has no database to look things up in.',
      language: 'en',
    })
    expect(bridge.completion.complete).toBe(true)

    const closed = await firstLesson()
    expect(closed.status).toBe('complete')
    expect(closed.completedAt).not.toBeNull()

    const events = await s.misc.listCompletionEvents()
    const forLesson = events.filter((e) => e.entityId === lesson.id)
    expect(forLesson).toHaveLength(1)
    expect(forLesson[0]?.evidence.explainBackIds.length).toBeGreaterThan(0)
    expect(forLesson[0]?.evidence.buildId).toBe(buildId)
    expect(forLesson[0]?.evidence.bridgeId).not.toBeNull()

    // A finished build never demotes: still applied after the full grade.
    expect((await s.concepts.getConcept(linked?.id ?? ''))?.status).toBe('applied')
  })

  it('writes exactly one completion event however many times it is rechecked', async () => {
    const lesson = await firstLesson()
    await s.completion.refreshLesson(lesson.id)
    await s.completion.refreshLesson(lesson.id)
    const events = await s.misc.listCompletionEvents()
    expect(events.filter((e) => e.entityId === lesson.id)).toHaveLength(1)
  })
})

describe('recall', () => {
  it('advances the Leitner box and records the answer', async () => {
    const concept = (await s.concepts.listConcepts()).find(
      (c) => c.concept === 'Training without understanding',
    )
    if (!concept) throw new Error('seed concept missing')

    const first = await s.concepts.recordRecall({
      conceptId: concept.id,
      question: 'What does backpropagation compute?',
      answer: 'The gradient for every parameter at once.',
      grade: 'full',
      now: new Date('2026-10-25T09:00:00.000Z'),
    })
    expect(first.schedule.recallBox).toBe(1)
    expect(first.schedule.nextRecallAt).toBe('2026-10-28T00:00:00.000Z')

    const miss = await s.concepts.recordRecall({
      conceptId: concept.id,
      question: 'Again?',
      answer: 'It measures activations.',
      grade: 'miss',
      now: new Date('2026-10-28T09:00:00.000Z'),
    })
    expect(miss.schedule.recallBox).toBe(0)

    expect(await s.concepts.recallHistory(concept.id)).toHaveLength(2)
  })

  it('completes a module once every lesson is done and a check passes', async () => {
    const { asc, eq } = await import('drizzle-orm')
    const [mod] = await s.client.db
      .select()
      .from(s.schema.modules)
      .orderBy(asc(s.schema.modules.order))
      .limit(1)
    if (!mod) throw new Error('seed module missing')

    const modLessons = await s.client.db
      .select()
      .from(s.schema.lessons)
      .where(eq(s.schema.lessons.moduleId, mod.id))

    // Close every lesson in the module with real evidence.
    for (const lesson of modLessons) {
      if (lesson.status === 'complete') continue
      await s.learning.saveExplainBack({
        lessonId: lesson.id,
        conceptId: null,
        prompt: 'Explain it.',
        answer: 'The mechanism, stated correctly.',
        grade: 'full',
        feedback: 'Correct.',
        missingPieces: '',
      })
      if (lesson.buildExercise) {
        const id = await s.learning.createBuild({
          lessonId: lesson.id,
          title: 'Run it',
          prediction: 'I expect X.',
        })
        await s.learning.updateBuild(id, { results: 'Y happened.', comparison: 'X was wrong.' })
      }
      await s.learning.saveBridge({ lessonId: lesson.id, text: 'Said plainly.', language: 'en' })
    }

    // Lessons alone are not enough: the module check has to pass too.
    let after = await s.completion.refreshModule(mod.id)
    expect(after.lessonsComplete).toBe(true)
    expect(after.complete).toBe(false)

    const moduleConcepts = await s.concepts.conceptsForModuleLessons(modLessons.map((l) => l.id))
    expect(moduleConcepts.length).toBeGreaterThan(0)

    // One run of four answers, three graded full.
    const runId = 'run-1'
    const grades = ['full', 'full', 'full', 'miss'] as const
    for (let i = 0; i < grades.length; i++) {
      const target = moduleConcepts[i % moduleConcepts.length]
      if (!target) continue
      await s.concepts.recordRecall({
        conceptId: target.id,
        question: `Question ${i + 1}`,
        answer: 'An answer.',
        grade: grades[i]!,
        moduleCheckRunId: runId,
      })
    }

    after = await s.completion.refreshModule(mod.id)
    expect(after.moduleCheckPassed).toBe(true)
    expect(after.complete).toBe(true)

    const events = await s.misc.listCompletionEvents()
    const moduleEvent = events.find((e) => e.entityType === 'module' && e.entityId === mod.id)
    expect(moduleEvent).toBeDefined()
    expect(moduleEvent?.evidence.lessonIds?.length).toBe(modLessons.length)
  })
})

describe('export and import', () => {
  it('round-trips the whole database', async () => {
    const before = await s.transfer.exportAll()
    const parsed = s.transfer.importSchema.safeParse(JSON.parse(JSON.stringify(before)))
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    const counts = await s.transfer.importAll(parsed.data)
    expect(counts.concepts).toBe(before.data.concepts.length)
    expect(counts.modules).toBe(before.data.modules.length)

    const after = await s.transfer.exportAll()
    expect(after.data.concepts.length).toBe(before.data.concepts.length)
    expect(after.data.completionEvents.length).toBe(before.data.completionEvents.length)
    expect(after.data.builds.length).toBe(before.data.builds.length)
  })

  it('rejects a file that is not a Lab export', async () => {
    expect(s.transfer.importSchema.safeParse({ lab: 'something-else' }).success).toBe(false)
    expect(s.transfer.importSchema.safeParse({}).success).toBe(false)
  })

  it('writes the concept register with the required column order', async () => {
    const markdown = await s.transfer.exportConceptsMarkdown()
    expect(markdown).toContain(
      '| Concept | Established name / source | My 1-line version | Where it breaks | Build link | Status | Date |',
    )
    expect(markdown).toContain('Training without understanding')
  })

  it('writes the completion register as a table', async () => {
    const markdown = await s.transfer.exportCompletionMarkdown()
    expect(markdown).toContain('# Completion register')
    expect(markdown).toContain('| Completed | Type | Module | What | Evidence |')
  })
})
