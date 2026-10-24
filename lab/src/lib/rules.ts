// The rules engine. Pure functions only: no database, no clock of its own, no
// I/O. Every caller passes the data and "now". Unit tested in
// tests/rules.test.ts, which covers each branch below.

import type { BuildStatus, ConceptStatus, Grade, ProgressStatus } from '@/lib/types'

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Midnight UTC of the day `date` falls in, as an ISO string. */
export function startOfDayIso(date: Date): string {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

/** Midnight UTC, `days` days after the day `date` falls in. */
export function addDaysIso(date: Date, days: number): string {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

export function isBlank(value: string | null | undefined): boolean {
  return (value ?? '').trim().length === 0
}

// ---------------------------------------------------------------------------
// Build: prediction before results
// ---------------------------------------------------------------------------

/**
 * Results may only be saved once a prediction exists. Enforced here, in the
 * API route and in the UI, so the loop cannot be short-circuited by replaying
 * a request.
 */
export function canSaveBuildResults(build: { prediction: string | null }): boolean {
  return !isBlank(build.prediction)
}

/** Status a build moves to once each field is filled in. */
export function buildStatus(build: {
  prediction: string | null
  results: string | null
}): BuildStatus {
  if (isBlank(build.prediction)) return 'planned'
  if (isBlank(build.results)) return 'predicted'
  return 'done'
}

/** A build that counts as evidence for lesson completion. */
export function isBuildDone(build: {
  status: BuildStatus
  prediction: string | null
  results: string | null
}): boolean {
  return (
    build.status === 'done' && !isBlank(build.prediction) && !isBlank(build.results)
  )
}

// ---------------------------------------------------------------------------
// Lesson completion
// ---------------------------------------------------------------------------

export type LessonCompletionInput = {
  lesson: { buildExercise: string | null }
  explainBacks: { id: string; grade: Grade; createdAt: string }[]
  builds: {
    id: string
    status: BuildStatus
    prediction: string | null
    results: string | null
    completedAt: string | null
  }[]
  bridges: { id: string; createdAt: string }[]
}

export type LessonCompletion = {
  complete: boolean
  /** Which of the three requirements are met. */
  requirements: { explainBack: boolean; build: boolean; bridge: boolean }
  /** What is still missing, in words the UI can show as-is. */
  missing: string[]
  /** Ids to record on the completionEvents row. Null until complete. */
  evidence: { explainBackIds: string[]; buildId: string | null; bridgeId: string | null } | null
}

/** Does this lesson require a build before it can complete? */
export function lessonRequiresBuild(lesson: { buildExercise: string | null }): boolean {
  return !isBlank(lesson.buildExercise)
}

/**
 * A lesson is complete when: one explain-back graded full, a done build if the
 * lesson has a build exercise, and one saved bridge. Never a manual checkbox.
 */
export function evaluateLesson(input: LessonCompletionInput): LessonCompletion {
  const fullExplainBacks = input.explainBacks.filter((e) => e.grade === 'full')
  const doneBuilds = input.builds.filter(isBuildDone)
  const needsBuild = lessonRequiresBuild(input.lesson)

  const requirements = {
    explainBack: fullExplainBacks.length > 0,
    build: needsBuild ? doneBuilds.length > 0 : true,
    bridge: input.bridges.length > 0,
  }

  const missing: string[] = []
  if (!requirements.explainBack) missing.push('An explain-back graded full')
  if (!requirements.build) missing.push('A build with prediction, results and comparison')
  if (!requirements.bridge) missing.push('A saved bridge')

  const complete =
    requirements.explainBack && requirements.build && requirements.bridge

  if (!complete) return { complete, requirements, missing, evidence: null }

  const firstBuild = [...doneBuilds].sort((a, b) =>
    (a.completedAt ?? '').localeCompare(b.completedAt ?? ''),
  )[0]
  const firstBridge = [...input.bridges].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )[0]

  return {
    complete,
    requirements,
    missing,
    evidence: {
      explainBackIds: fullExplainBacks.map((e) => e.id),
      buildId: firstBuild ? firstBuild.id : null,
      bridgeId: firstBridge ? firstBridge.id : null,
    },
  }
}

// ---------------------------------------------------------------------------
// Module completion
// ---------------------------------------------------------------------------

export const MODULE_CHECK_QUESTIONS = 4
export const MODULE_CHECK_REQUIRED_FULL = 3

export type ModuleCheckResult = {
  questions: number
  fulls: number
  passed: boolean
}

/** One module check run: 4 questions, at least 3 of them graded full. */
export function evaluateModuleCheck(grades: Grade[]): ModuleCheckResult {
  const fulls = grades.filter((g) => g === 'full').length
  return {
    questions: grades.length,
    fulls,
    passed:
      grades.length >= MODULE_CHECK_QUESTIONS && fulls >= MODULE_CHECK_REQUIRED_FULL,
  }
}

export type ModuleCompletionInput = {
  lessons: { id: string; status: ProgressStatus }[]
  /** Grades of each module check run attempted so far, newest order irrelevant. */
  moduleCheckRuns: Grade[][]
}

export type ModuleCompletion = {
  complete: boolean
  lessonsComplete: boolean
  lessonsDone: number
  lessonsTotal: number
  moduleCheckPassed: boolean
  bestCheck: ModuleCheckResult | null
  missing: string[]
}

/** All lessons complete, plus a passed module check. */
export function evaluateModule(input: ModuleCompletionInput): ModuleCompletion {
  const lessonsTotal = input.lessons.length
  const lessonsDone = input.lessons.filter((l) => l.status === 'complete').length
  const lessonsComplete = lessonsTotal > 0 && lessonsDone === lessonsTotal

  const checks = input.moduleCheckRuns.map(evaluateModuleCheck)
  const moduleCheckPassed = checks.some((c) => c.passed)
  const bestCheck =
    checks.length === 0
      ? null
      : checks.reduce((best, c) => (c.fulls > best.fulls ? c : best), checks[0]!)

  const missing: string[] = []
  if (!lessonsComplete) {
    missing.push(`${lessonsTotal - lessonsDone} lesson(s) still open`)
  }
  if (!moduleCheckPassed) {
    missing.push(
      `Module check: ${MODULE_CHECK_REQUIRED_FULL} of ${MODULE_CHECK_QUESTIONS} graded full`,
    )
  }

  return {
    complete: lessonsComplete && moduleCheckPassed,
    lessonsComplete,
    lessonsDone,
    lessonsTotal,
    moduleCheckPassed,
    bestCheck,
    missing,
  }
}

// ---------------------------------------------------------------------------
// Concept status ladder
// ---------------------------------------------------------------------------

const CONCEPT_RANK: Record<ConceptStatus, number> = {
  met: 0,
  explained_back_partial: 1,
  explained_back: 2,
  applied: 3,
  taught: 4,
}

export function conceptRank(status: ConceptStatus): number {
  return CONCEPT_RANK[status]
}

/** Promote only: never move a concept back down the ladder. */
function promote(current: ConceptStatus, target: ConceptStatus): ConceptStatus {
  return CONCEPT_RANK[target] > CONCEPT_RANK[current] ? target : current
}

/**
 * full promotes to explained_back (never demotes). partial sets
 * explained_back_partial only from met. miss changes nothing.
 */
export function conceptStatusAfterExplainBack(
  current: ConceptStatus,
  grade: Grade,
): ConceptStatus {
  if (grade === 'full') return promote(current, 'explained_back')
  if (grade === 'partial') return current === 'met' ? 'explained_back_partial' : current
  return current
}

/** A completed build linked to the concept promotes it to applied. */
export function conceptStatusAfterBuildDone(current: ConceptStatus): ConceptStatus {
  return promote(current, 'applied')
}

// ---------------------------------------------------------------------------
// Spaced recall (Leitner)
// ---------------------------------------------------------------------------

export const RECALL_INTERVAL_DAYS = [1, 3, 7, 16, 35, 90] as const
export const MAX_RECALL_BOX = RECALL_INTERVAL_DAYS.length - 1 // 5

export function clampBox(box: number): number {
  if (!Number.isFinite(box)) return 0
  return Math.min(MAX_RECALL_BOX, Math.max(0, Math.trunc(box)))
}

export function intervalDaysForBox(box: number): number {
  return RECALL_INTERVAL_DAYS[clampBox(box)]!
}

/** Concepts at met are not scheduled; scheduling starts at partial or above. */
export function isScheduledForRecall(status: ConceptStatus): boolean {
  return CONCEPT_RANK[status] >= CONCEPT_RANK.explained_back_partial
}

export type RecallSchedule = {
  recallBox: number
  nextRecallAt: string | null
  lastRecalledAt: string | null
}

/**
 * The schedule a concept gets the moment it becomes eligible (its first
 * promotion past met). Box 0, due in 1 day.
 */
export function initialRecallSchedule(
  status: ConceptStatus,
  now: Date,
): RecallSchedule {
  if (!isScheduledForRecall(status)) {
    return { recallBox: 0, nextRecallAt: null, lastRecalledAt: null }
  }
  return {
    recallBox: 0,
    nextRecallAt: addDaysIso(now, intervalDaysForBox(0)),
    lastRecalledAt: null,
  }
}

/**
 * Leitner step. full: box + 1 (max 5), next interval from the new box.
 * partial: same box, due again in 1 day. miss: back to box 0.
 */
export function nextRecallSchedule(input: {
  recallBox: number
  status: ConceptStatus
  grade: Grade
  now: Date
}): RecallSchedule {
  const current = clampBox(input.recallBox)
  const lastRecalledAt = input.now.toISOString()

  if (!isScheduledForRecall(input.status)) {
    return { recallBox: current, nextRecallAt: null, lastRecalledAt }
  }

  if (input.grade === 'full') {
    const box = clampBox(current + 1)
    return { recallBox: box, nextRecallAt: addDaysIso(input.now, intervalDaysForBox(box)), lastRecalledAt }
  }

  if (input.grade === 'partial') {
    return { recallBox: current, nextRecallAt: addDaysIso(input.now, 1), lastRecalledAt }
  }

  return { recallBox: 0, nextRecallAt: addDaysIso(input.now, intervalDaysForBox(0)), lastRecalledAt }
}

/** Due when scheduled and the due date has arrived (midnight UTC that day). */
export function isRecallDue(
  concept: { status: ConceptStatus; nextRecallAt: string | null },
  now: Date,
): boolean {
  if (!isScheduledForRecall(concept.status)) return false
  if (!concept.nextRecallAt) return false
  return concept.nextRecallAt <= now.toISOString()
}

/** Due concepts, soonest due first. */
export function dueConcepts<T extends { status: ConceptStatus; nextRecallAt: string | null }>(
  concepts: T[],
  now: Date,
): T[] {
  return concepts
    .filter((c) => isRecallDue(c, now))
    .sort((a, b) => (a.nextRecallAt ?? '').localeCompare(b.nextRecallAt ?? ''))
}

// ---------------------------------------------------------------------------
// The loop, as shown on a lesson and on Today
// ---------------------------------------------------------------------------

export type LoopState = {
  prework: boolean
  session: boolean
  build: boolean
  explain_back: boolean
  bridge: boolean
}

export type LoopStateInput = {
  lesson: { buildExercise: string | null }
  /** Sources for this lesson's module; pre-work counts as done when all are read. */
  preWorkDone: boolean
  sessionCount: number
  explainBacks: { id: string; grade: Grade; createdAt: string }[]
  builds: {
    id: string
    status: BuildStatus
    prediction: string | null
    results: string | null
    completedAt: string | null
  }[]
  bridges: { id: string; createdAt: string }[]
}

export function evaluateLoop(input: LoopStateInput): LoopState {
  const lesson = evaluateLesson({
    lesson: input.lesson,
    explainBacks: input.explainBacks,
    builds: input.builds,
    bridges: input.bridges,
  })
  return {
    prework: input.preWorkDone,
    session: input.sessionCount > 0,
    build: lesson.requirements.build,
    explain_back: lesson.requirements.explainBack,
    bridge: lesson.requirements.bridge,
  }
}

/** The next step of the loop to act on, or null when the lesson is done. */
export function nextLoopStep(state: LoopState): keyof LoopState | null {
  const order: (keyof LoopState)[] = [
    'prework',
    'session',
    'build',
    'explain_back',
    'bridge',
  ]
  return order.find((step) => !state[step]) ?? null
}
