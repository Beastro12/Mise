import { describe, it, expect } from 'vitest'
import {
  addDaysIso,
  buildStatus,
  canSaveBuildResults,
  clampBox,
  conceptRank,
  conceptStatusAfterBuildDone,
  conceptStatusAfterExplainBack,
  dueConcepts,
  evaluateLesson,
  evaluateLoop,
  evaluateModule,
  evaluateModuleCheck,
  initialRecallSchedule,
  intervalDaysForBox,
  isBlank,
  isBuildDone,
  isRecallDue,
  isScheduledForRecall,
  lessonRequiresBuild,
  MAX_RECALL_BOX,
  MODULE_CHECK_QUESTIONS,
  MODULE_CHECK_REQUIRED_FULL,
  nextLoopStep,
  nextRecallSchedule,
  RECALL_INTERVAL_DAYS,
  startOfDayIso,
  type LessonCompletionInput,
} from '@/lib/rules'
import { CONCEPT_STATUSES, GRADES, type ConceptStatus, type Grade } from '@/lib/types'

const NOW = new Date('2026-10-24T13:45:00.000Z')

const explainBack = (grade: Grade, id = `eb-${grade}`) => ({
  id,
  grade,
  createdAt: '2026-10-24T10:00:00.000Z',
})

const doneBuild = (id = 'b1') => ({
  id,
  status: 'done' as const,
  prediction: 'I expect 3 of 5 to differ',
  results: '4 of 5 differed',
  completedAt: '2026-10-24T11:00:00.000Z',
})

const bridge = (id = 'br1') => ({ id, createdAt: '2026-10-24T12:00:00.000Z' })

const lessonInput = (
  over: Partial<LessonCompletionInput> = {},
): LessonCompletionInput => ({
  lesson: { buildExercise: 'Run one factual prompt 5 times' },
  explainBacks: [],
  builds: [],
  bridges: [],
  ...over,
})

// ---------------------------------------------------------------------------

describe('date helpers', () => {
  it('startOfDayIso truncates to midnight UTC', () => {
    expect(startOfDayIso(NOW)).toBe('2026-10-24T00:00:00.000Z')
  })

  it('addDaysIso lands on midnight UTC of the target day', () => {
    expect(addDaysIso(NOW, 1)).toBe('2026-10-25T00:00:00.000Z')
    expect(addDaysIso(NOW, 90)).toBe('2027-01-22T00:00:00.000Z')
  })

  it('addDaysIso(0) is the same as startOfDayIso', () => {
    expect(addDaysIso(NOW, 0)).toBe(startOfDayIso(NOW))
  })

  it('addDaysIso does not mutate its argument', () => {
    const d = new Date(NOW)
    addDaysIso(d, 5)
    expect(d.toISOString()).toBe(NOW.toISOString())
  })

  it('isBlank treats empty, whitespace, null and undefined as blank', () => {
    expect(isBlank('')).toBe(true)
    expect(isBlank('   \n\t ')).toBe(true)
    expect(isBlank(null)).toBe(true)
    expect(isBlank(undefined)).toBe(true)
    expect(isBlank('x')).toBe(false)
  })
})

// ---------------------------------------------------------------------------

describe('prediction before results', () => {
  it('blocks results while the prediction is empty', () => {
    expect(canSaveBuildResults({ prediction: '' })).toBe(false)
    expect(canSaveBuildResults({ prediction: '   ' })).toBe(false)
    expect(canSaveBuildResults({ prediction: null })).toBe(false)
  })

  it('allows results once a prediction exists', () => {
    expect(canSaveBuildResults({ prediction: 'I expect drift' })).toBe(true)
  })

  it('derives status from which fields are filled', () => {
    expect(buildStatus({ prediction: '', results: '' })).toBe('planned')
    expect(buildStatus({ prediction: null, results: 'anything' })).toBe('planned')
    expect(buildStatus({ prediction: 'p', results: '' })).toBe('predicted')
    expect(buildStatus({ prediction: 'p', results: null })).toBe('predicted')
    expect(buildStatus({ prediction: 'p', results: 'r' })).toBe('done')
  })

  it('isBuildDone requires status done plus both fields', () => {
    expect(isBuildDone(doneBuild())).toBe(true)
    expect(isBuildDone({ ...doneBuild(), status: 'predicted' })).toBe(false)
    expect(isBuildDone({ ...doneBuild(), prediction: '' })).toBe(false)
    expect(isBuildDone({ ...doneBuild(), results: '  ' })).toBe(false)
  })
})

// ---------------------------------------------------------------------------

describe('lesson completion', () => {
  it('lessonRequiresBuild follows the buildExercise field', () => {
    expect(lessonRequiresBuild({ buildExercise: 'do a thing' })).toBe(true)
    expect(lessonRequiresBuild({ buildExercise: null })).toBe(false)
    expect(lessonRequiresBuild({ buildExercise: '  ' })).toBe(false)
  })

  it('is incomplete with nothing done, and names all three gaps', () => {
    const result = evaluateLesson(lessonInput())
    expect(result.complete).toBe(false)
    expect(result.requirements).toEqual({
      explainBack: false,
      build: false,
      bridge: false,
    })
    expect(result.missing).toHaveLength(3)
    expect(result.evidence).toBeNull()
  })

  it('is incomplete when the only explain-back is partial', () => {
    const result = evaluateLesson(
      lessonInput({
        explainBacks: [explainBack('partial')],
        builds: [doneBuild()],
        bridges: [bridge()],
      }),
    )
    expect(result.complete).toBe(false)
    expect(result.requirements.explainBack).toBe(false)
    expect(result.missing).toEqual(['An explain-back graded full'])
  })

  it('is incomplete when the only explain-back is a miss', () => {
    const result = evaluateLesson(
      lessonInput({
        explainBacks: [explainBack('miss')],
        builds: [doneBuild()],
        bridges: [bridge()],
      }),
    )
    expect(result.complete).toBe(false)
  })

  it('is incomplete when the build has no results yet', () => {
    const result = evaluateLesson(
      lessonInput({
        explainBacks: [explainBack('full')],
        builds: [{ ...doneBuild(), status: 'predicted', results: '' }],
        bridges: [bridge()],
      }),
    )
    expect(result.complete).toBe(false)
    expect(result.requirements.build).toBe(false)
    expect(result.missing).toEqual([
      'A build with prediction, results and comparison',
    ])
  })

  it('is incomplete when the build has results but no prediction', () => {
    const result = evaluateLesson(
      lessonInput({
        explainBacks: [explainBack('full')],
        builds: [{ ...doneBuild(), prediction: '' }],
        bridges: [bridge()],
      }),
    )
    expect(result.complete).toBe(false)
    expect(result.requirements.build).toBe(false)
  })

  it('is incomplete without a bridge', () => {
    const result = evaluateLesson(
      lessonInput({
        explainBacks: [explainBack('full')],
        builds: [doneBuild()],
      }),
    )
    expect(result.complete).toBe(false)
    expect(result.missing).toEqual(['A saved bridge'])
  })

  it('completes with a full explain-back, a done build and a bridge', () => {
    const result = evaluateLesson(
      lessonInput({
        explainBacks: [explainBack('partial', 'eb1'), explainBack('full', 'eb2')],
        builds: [doneBuild('b1')],
        bridges: [bridge('br1')],
      }),
    )
    expect(result.complete).toBe(true)
    expect(result.missing).toEqual([])
    expect(result.evidence).toEqual({
      explainBackIds: ['eb2'],
      buildId: 'b1',
      bridgeId: 'br1',
    })
  })

  it('records every full explain-back as evidence', () => {
    const result = evaluateLesson(
      lessonInput({
        explainBacks: [explainBack('full', 'eb1'), explainBack('full', 'eb2')],
        builds: [doneBuild()],
        bridges: [bridge()],
      }),
    )
    expect(result.evidence?.explainBackIds).toEqual(['eb1', 'eb2'])
  })

  it('picks the earliest done build and earliest bridge as evidence', () => {
    const result = evaluateLesson(
      lessonInput({
        explainBacks: [explainBack('full')],
        builds: [
          { ...doneBuild('late'), completedAt: '2026-10-24T18:00:00.000Z' },
          { ...doneBuild('early'), completedAt: '2026-10-24T08:00:00.000Z' },
        ],
        bridges: [
          { id: 'late', createdAt: '2026-10-24T19:00:00.000Z' },
          { id: 'early', createdAt: '2026-10-24T09:00:00.000Z' },
        ],
      }),
    )
    expect(result.evidence?.buildId).toBe('early')
    expect(result.evidence?.bridgeId).toBe('early')
  })

  it('completes a build-free lesson without any build', () => {
    const result = evaluateLesson(
      lessonInput({
        lesson: { buildExercise: null },
        explainBacks: [explainBack('full')],
        bridges: [bridge()],
      }),
    )
    expect(result.complete).toBe(true)
    expect(result.requirements.build).toBe(true)
    expect(result.evidence?.buildId).toBeNull()
  })
})

// ---------------------------------------------------------------------------

describe('module check', () => {
  it('needs 4 questions', () => {
    expect(evaluateModuleCheck(['full', 'full', 'full'])).toEqual({
      questions: 3,
      fulls: 3,
      passed: false,
    })
  })

  it('needs 3 of them full', () => {
    expect(evaluateModuleCheck(['full', 'full', 'partial', 'miss']).passed).toBe(false)
    expect(evaluateModuleCheck(['full', 'full', 'full', 'miss']).passed).toBe(true)
    expect(evaluateModuleCheck(['full', 'full', 'full', 'full']).passed).toBe(true)
  })

  it('counts a longer run too', () => {
    const result = evaluateModuleCheck(['miss', 'full', 'full', 'partial', 'full'])
    expect(result).toEqual({ questions: 5, fulls: 3, passed: true })
  })

  it('handles an empty run', () => {
    expect(evaluateModuleCheck([])).toEqual({ questions: 0, fulls: 0, passed: false })
  })

  it('uses the documented thresholds', () => {
    expect(MODULE_CHECK_QUESTIONS).toBe(4)
    expect(MODULE_CHECK_REQUIRED_FULL).toBe(3)
  })
})

describe('module completion', () => {
  const allDone = [
    { id: 'l1', status: 'complete' as const },
    { id: 'l2', status: 'complete' as const },
  ]

  it('needs every lesson complete', () => {
    const result = evaluateModule({
      lessons: [{ id: 'l1', status: 'complete' }, { id: 'l2', status: 'in_progress' }],
      moduleCheckRuns: [['full', 'full', 'full', 'full']],
    })
    expect(result.complete).toBe(false)
    expect(result.lessonsComplete).toBe(false)
    expect(result.lessonsDone).toBe(1)
    expect(result.lessonsTotal).toBe(2)
    expect(result.missing).toContain('1 lesson(s) still open')
  })

  it('needs a passed module check', () => {
    const result = evaluateModule({ lessons: allDone, moduleCheckRuns: [] })
    expect(result.complete).toBe(false)
    expect(result.moduleCheckPassed).toBe(false)
    expect(result.bestCheck).toBeNull()
  })

  it('passes on any one passing run, even after failed attempts', () => {
    const result = evaluateModule({
      lessons: allDone,
      moduleCheckRuns: [
        ['miss', 'miss', 'partial', 'full'],
        ['full', 'full', 'full', 'partial'],
      ],
    })
    expect(result.complete).toBe(true)
    expect(result.moduleCheckPassed).toBe(true)
    expect(result.bestCheck?.fulls).toBe(3)
  })

  it('reports the best failed attempt while still incomplete', () => {
    const result = evaluateModule({
      lessons: allDone,
      moduleCheckRuns: [['miss', 'miss', 'miss', 'miss'], ['full', 'full', 'miss', 'miss']],
    })
    expect(result.complete).toBe(false)
    expect(result.bestCheck?.fulls).toBe(2)
    expect(result.missing).toContain('Module check: 3 of 4 graded full')
  })

  it('is not complete when a module has no lessons at all', () => {
    const result = evaluateModule({
      lessons: [],
      moduleCheckRuns: [['full', 'full', 'full', 'full']],
    })
    expect(result.complete).toBe(false)
    expect(result.lessonsComplete).toBe(false)
  })

  it('treats not_started lessons as open', () => {
    const result = evaluateModule({
      lessons: [{ id: 'l1', status: 'not_started' }],
      moduleCheckRuns: [['full', 'full', 'full', 'full']],
    })
    expect(result.complete).toBe(false)
  })
})

// ---------------------------------------------------------------------------

describe('concept status ladder', () => {
  it('ranks the ladder in order', () => {
    const ranks = CONCEPT_STATUSES.map(conceptRank)
    expect(ranks).toEqual([0, 1, 2, 3, 4])
  })

  it('full promotes met and partial to explained_back', () => {
    expect(conceptStatusAfterExplainBack('met', 'full')).toBe('explained_back')
    expect(conceptStatusAfterExplainBack('explained_back_partial', 'full')).toBe(
      'explained_back',
    )
  })

  it('full never demotes applied or taught', () => {
    expect(conceptStatusAfterExplainBack('applied', 'full')).toBe('applied')
    expect(conceptStatusAfterExplainBack('taught', 'full')).toBe('taught')
    expect(conceptStatusAfterExplainBack('explained_back', 'full')).toBe('explained_back')
  })

  it('partial promotes met only', () => {
    expect(conceptStatusAfterExplainBack('met', 'partial')).toBe(
      'explained_back_partial',
    )
    expect(conceptStatusAfterExplainBack('explained_back_partial', 'partial')).toBe(
      'explained_back_partial',
    )
    expect(conceptStatusAfterExplainBack('explained_back', 'partial')).toBe(
      'explained_back',
    )
    expect(conceptStatusAfterExplainBack('applied', 'partial')).toBe('applied')
    expect(conceptStatusAfterExplainBack('taught', 'partial')).toBe('taught')
  })

  it('a miss changes nothing, from any status', () => {
    for (const status of CONCEPT_STATUSES) {
      expect(conceptStatusAfterExplainBack(status, 'miss')).toBe(status)
    }
  })

  it('a done build promotes to applied, and never demotes taught', () => {
    expect(conceptStatusAfterBuildDone('met')).toBe('applied')
    expect(conceptStatusAfterBuildDone('explained_back_partial')).toBe('applied')
    expect(conceptStatusAfterBuildDone('explained_back')).toBe('applied')
    expect(conceptStatusAfterBuildDone('applied')).toBe('applied')
    expect(conceptStatusAfterBuildDone('taught')).toBe('taught')
  })

  it('never moves a concept down the ladder, for any status and grade', () => {
    for (const status of CONCEPT_STATUSES) {
      for (const grade of GRADES) {
        const next = conceptStatusAfterExplainBack(status, grade)
        expect(conceptRank(next)).toBeGreaterThanOrEqual(conceptRank(status))
      }
      expect(conceptRank(conceptStatusAfterBuildDone(status))).toBeGreaterThanOrEqual(
        conceptRank(status),
      )
    }
  })
})

// ---------------------------------------------------------------------------

describe('spaced recall (Leitner)', () => {
  it('uses the documented intervals', () => {
    expect([...RECALL_INTERVAL_DAYS]).toEqual([1, 3, 7, 16, 35, 90])
    expect(MAX_RECALL_BOX).toBe(5)
    expect(RECALL_INTERVAL_DAYS.map((_, i) => intervalDaysForBox(i))).toEqual([
      1, 3, 7, 16, 35, 90,
    ])
  })

  it('clamps boxes out of range', () => {
    expect(clampBox(-3)).toBe(0)
    expect(clampBox(9)).toBe(5)
    expect(clampBox(2.7)).toBe(2)
    expect(clampBox(Number.NaN)).toBe(0)
    expect(intervalDaysForBox(99)).toBe(90)
    expect(intervalDaysForBox(-1)).toBe(1)
  })

  it('schedules from explained_back_partial upward only', () => {
    expect(isScheduledForRecall('met')).toBe(false)
    expect(isScheduledForRecall('explained_back_partial')).toBe(true)
    expect(isScheduledForRecall('explained_back')).toBe(true)
    expect(isScheduledForRecall('applied')).toBe(true)
    expect(isScheduledForRecall('taught')).toBe(true)
  })

  it('gives a newly eligible concept box 0, due in a day', () => {
    expect(initialRecallSchedule('explained_back_partial', NOW)).toEqual({
      recallBox: 0,
      nextRecallAt: '2026-10-25T00:00:00.000Z',
      lastRecalledAt: null,
    })
  })

  it('does not schedule a concept still at met', () => {
    expect(initialRecallSchedule('met', NOW)).toEqual({
      recallBox: 0,
      nextRecallAt: null,
      lastRecalledAt: null,
    })
  })

  it('full moves up a box and uses the new box interval', () => {
    const steps = [0, 1, 2, 3, 4].map((box) =>
      nextRecallSchedule({ recallBox: box, status: 'explained_back', grade: 'full', now: NOW }),
    )
    expect(steps.map((s) => s.recallBox)).toEqual([1, 2, 3, 4, 5])
    expect(steps.map((s) => s.nextRecallAt)).toEqual([
      addDaysIso(NOW, 3),
      addDaysIso(NOW, 7),
      addDaysIso(NOW, 16),
      addDaysIso(NOW, 35),
      addDaysIso(NOW, 90),
    ])
  })

  it('full at box 5 stays at box 5 with the 90 day interval', () => {
    const result = nextRecallSchedule({
      recallBox: 5,
      status: 'applied',
      grade: 'full',
      now: NOW,
    })
    expect(result.recallBox).toBe(5)
    expect(result.nextRecallAt).toBe(addDaysIso(NOW, 90))
  })

  it('partial keeps the box and comes back tomorrow', () => {
    const result = nextRecallSchedule({
      recallBox: 3,
      status: 'explained_back',
      grade: 'partial',
      now: NOW,
    })
    expect(result.recallBox).toBe(3)
    expect(result.nextRecallAt).toBe(addDaysIso(NOW, 1))
  })

  it('a miss resets to box 0', () => {
    const result = nextRecallSchedule({
      recallBox: 5,
      status: 'applied',
      grade: 'miss',
      now: NOW,
    })
    expect(result.recallBox).toBe(0)
    expect(result.nextRecallAt).toBe(addDaysIso(NOW, 1))
  })

  it('records when the answer was given', () => {
    const result = nextRecallSchedule({
      recallBox: 0,
      status: 'explained_back',
      grade: 'full',
      now: NOW,
    })
    expect(result.lastRecalledAt).toBe(NOW.toISOString())
  })

  it('does not schedule a concept at met, whatever the grade', () => {
    for (const grade of GRADES) {
      const result = nextRecallSchedule({ recallBox: 2, status: 'met', grade, now: NOW })
      expect(result.nextRecallAt).toBeNull()
      expect(result.recallBox).toBe(2)
    }
  })

  it('is due once the due date has arrived', () => {
    const c = (nextRecallAt: string | null, status: ConceptStatus = 'explained_back') => ({
      status,
      nextRecallAt,
    })
    expect(isRecallDue(c('2026-10-24T00:00:00.000Z'), NOW)).toBe(true)
    expect(isRecallDue(c('2026-10-23T00:00:00.000Z'), NOW)).toBe(true)
    expect(isRecallDue(c('2026-10-25T00:00:00.000Z'), NOW)).toBe(false)
    expect(isRecallDue(c(null), NOW)).toBe(false)
    expect(isRecallDue(c('2026-10-24T00:00:00.000Z', 'met'), NOW)).toBe(false)
  })

  it('lists due concepts soonest first and drops the rest', () => {
    const concepts = [
      { id: 'c-later', status: 'explained_back' as const, nextRecallAt: '2026-10-24T00:00:00.000Z' },
      { id: 'c-oldest', status: 'applied' as const, nextRecallAt: '2026-10-20T00:00:00.000Z' },
      { id: 'c-future', status: 'applied' as const, nextRecallAt: '2026-11-01T00:00:00.000Z' },
      { id: 'c-met', status: 'met' as const, nextRecallAt: '2026-10-01T00:00:00.000Z' },
      { id: 'c-unscheduled', status: 'applied' as const, nextRecallAt: null },
    ]
    expect(dueConcepts(concepts, NOW).map((c) => c.id)).toEqual(['c-oldest', 'c-later'])
  })
})

// ---------------------------------------------------------------------------

describe('loop state', () => {
  const base = {
    lesson: { buildExercise: 'something' },
    preWorkDone: false,
    sessionCount: 0,
    explainBacks: [],
    builds: [],
    bridges: [],
  }

  it('starts with every step open and points at pre-work', () => {
    const state = evaluateLoop(base)
    expect(state).toEqual({
      prework: false,
      session: false,
      build: false,
      explain_back: false,
      bridge: false,
    })
    expect(nextLoopStep(state)).toBe('prework')
  })

  it('walks the loop in order as each step lands', () => {
    expect(nextLoopStep(evaluateLoop({ ...base, preWorkDone: true }))).toBe('session')
    expect(
      nextLoopStep(evaluateLoop({ ...base, preWorkDone: true, sessionCount: 2 })),
    ).toBe('build')
    expect(
      nextLoopStep(
        evaluateLoop({
          ...base,
          preWorkDone: true,
          sessionCount: 1,
          builds: [doneBuild()],
        }),
      ),
    ).toBe('explain_back')
    expect(
      nextLoopStep(
        evaluateLoop({
          ...base,
          preWorkDone: true,
          sessionCount: 1,
          builds: [doneBuild()],
          explainBacks: [explainBack('full')],
        }),
      ),
    ).toBe('bridge')
  })

  it('reports no next step once the whole loop is done', () => {
    const state = evaluateLoop({
      ...base,
      preWorkDone: true,
      sessionCount: 1,
      builds: [doneBuild()],
      explainBacks: [explainBack('full')],
      bridges: [bridge()],
    })
    expect(nextLoopStep(state)).toBeNull()
  })

  it('counts the build step as done when the lesson has no build', () => {
    const state = evaluateLoop({ ...base, lesson: { buildExercise: null } })
    expect(state.build).toBe(true)
    expect(nextLoopStep(state)).toBe('prework')
  })
})
