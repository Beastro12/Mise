import { z } from 'zod'
import {
  BRIDGE_LANGUAGES,
  CONCEPT_STATUSES,
  GRADES,
  PARKING_STATUSES,
  READ_STATUSES,
  SESSION_MODES,
} from '@/lib/types'
import { idSchema, nonEmpty } from '@/lib/api'

export const startSessionInput = z.object({
  lessonId: idSchema.nullable().default(null),
  mode: z.enum(SESSION_MODES).default('tutor'),
})

export const tutorTurnInput = z.object({
  sessionId: idSchema,
  message: nonEmpty('your message'),
})

export const explainBackInput = z.object({
  lessonId: idSchema,
  conceptId: idSchema.nullable().default(null),
  prompt: nonEmpty('the question'),
  answer: nonEmpty('your answer'),
})

export const createBuildInput = z.object({
  lessonId: idSchema,
  title: nonEmpty('the build title'),
  prediction: nonEmpty('the prediction'),
  conceptId: idSchema.nullable().default(null),
})

export const updateBuildInput = z
  .object({
    title: z.string().trim().min(1).optional(),
    prediction: z.string().optional(),
    results: z.string().optional(),
    comparison: z.string().optional(),
    conceptId: idSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'nothing to update',
  })

export const bridgeInput = z.object({
  lessonId: idSchema,
  text: nonEmpty('the bridge'),
  language: z.enum(BRIDGE_LANGUAGES).default('en'),
})

export const createConceptInput = z.object({
  concept: nonEmpty('the concept'),
  establishedName: z.string().default(''),
  myVersion: z.string().default(''),
  whereItBreaks: z.string().default(''),
  buildLink: z.string().default(''),
  status: z.enum(CONCEPT_STATUSES).default('met'),
  lessonId: idSchema.nullable().default(null),
})

export const updateConceptInput = z
  .object({
    concept: z.string().trim().min(1).optional(),
    establishedName: z.string().optional(),
    myVersion: z.string().optional(),
    whereItBreaks: z.string().optional(),
    buildLink: z.string().optional(),
    status: z.enum(CONCEPT_STATUSES).optional(),
    lessonId: idSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'nothing to update' })

export const recallQuestionInput = z.object({ conceptId: idSchema })

export const recallAnswerInput = z.object({
  conceptId: idSchema,
  question: nonEmpty('the question'),
  expectedAnswer: z.string().default(''),
  answer: nonEmpty('your answer'),
  moduleCheckRunId: z.string().min(1).nullable().default(null),
})

export const moduleCheckInput = z.object({ moduleId: idSchema })

export const parkInput = z.object({
  text: nonEmpty('the note'),
  source: z.string().default('manual'),
})

export const parkingStatusInput = z.object({ status: z.enum(PARKING_STATUSES) })

export const sourceStatusInput = z.object({ readStatus: z.enum(READ_STATUSES) })

export const preWorkInput = z.object({ done: z.boolean() })

export const gradeManualInput = z.object({ grade: z.enum(GRADES) })

export const markdownKindInput = z.object({
  kind: z.enum(['concepts', 'completion']),
})
