// Response shapes for the structured model calls. No 'server-only' here on
// purpose: the types are shown in client components (the concept proposals
// editor), while the calls themselves live in structured.ts.

import { z } from 'zod'
import { CONCEPT_STATUSES, GRADES } from '@/lib/types'

export const gradeSchema = z.object({
  grade: z.enum(GRADES),
  feedback: z.string().min(1),
  missingPieces: z.string().default(''),
})
export type GradeResult = z.infer<typeof gradeSchema>

export const conceptProposalSchema = z.object({
  concept: z.string().min(1),
  establishedName: z.string().default(''),
  myVersion: z.string().default(''),
  whereItBreaks: z.string().default(''),
  buildLink: z.string().default(''),
  status: z.enum(CONCEPT_STATUSES).default('met'),
})
export type ConceptProposal = z.infer<typeof conceptProposalSchema>

export const conceptProposalsSchema = z.object({
  concepts: z.array(conceptProposalSchema).max(8),
})

export const summarySchema = z.object({ summary: z.string().min(1) })

export const recallQuestionSchema = z.object({
  question: z.string().min(1),
  expectedAnswer: z.string().min(1),
})
export type RecallQuestion = z.infer<typeof recallQuestionSchema>
