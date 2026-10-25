import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { requireModel } from '@/lib/env'
import { anthropic, InvalidModelResponse, MAX_TOKENS } from './client'
import {
  conceptProposalsSchema,
  gradeSchema,
  recallQuestionSchema,
  summarySchema,
  type ConceptProposal,
  type GradeResult,
  type RecallQuestion,
} from './shapes'
import { loadPrompt } from './prompt-files'

/** Only text blocks. Thinking blocks are on by default and must be skipped. */
function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()
}

/** Tolerates a ```json fence or a sentence before the object. */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = (fenced?.[1] ?? raw).trim()
  const firstBrace = body.search(/[[{]/)
  if (firstBrace === -1) return body
  const lastBrace = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'))
  return lastBrace > firstBrace ? body.slice(firstBrace, lastBrace + 1) : body.slice(firstBrace)
}

/**
 * One structured call: ask for JSON, validate it with zod, and retry exactly
 * once with the validation error fed back. A second failure is surfaced to the
 * user rather than guessed at.
 */
async function callStructured<T>(options: {
  system: string
  user: string
  schema: z.ZodType<T>
}): Promise<T> {
  const client = anthropic()
  const model = requireModel('grader')
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: options.user }]
  let lastProblem = ''

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS.structured,
      system: options.system,
      messages,
    })
    const raw = textOf(response)

    let parsed: unknown
    try {
      parsed = JSON.parse(extractJson(raw))
    } catch {
      lastProblem = 'the reply was not valid JSON'
      messages.push(
        { role: 'assistant', content: raw || '(empty reply)' },
        {
          role: 'user',
          content:
            'That was not valid JSON. Reply again with only the JSON object, no prose and no code fence.',
        },
      )
      continue
    }

    const result = options.schema.safeParse(parsed)
    if (result.success) return result.data

    lastProblem = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('; ')
    messages.push(
      { role: 'assistant', content: raw },
      {
        role: 'user',
        content: `That JSON did not match the required shape (${lastProblem}). Reply again with only the corrected JSON object.`,
      },
    )
  }

  throw new InvalidModelResponse(
    `The model did not return the required JSON after two attempts (${lastProblem}). Try again, or check prompts/grader.md if you have edited it.`,
  )
}

export * from './shapes'

const JSON_ONLY = 'Reply with only a JSON object. No prose, no code fence.'

// ---------------------------------------------------------------------------
// The five structured calls
// ---------------------------------------------------------------------------

export async function gradeExplainBack(input: {
  concept: string
  lessonObjectives: string
  prompt: string
  answer: string
}): Promise<GradeResult> {
  const rubric = await loadPrompt('grader')
  return callStructured({
    system: `${rubric}\n\n${JSON_ONLY} Shape: {"grade":"full"|"partial"|"miss","feedback":string,"missingPieces":string}. Keep feedback to 80 words or fewer.`,
    user: [
      `Concept: ${input.concept || '(not linked to one concept)'}`,
      '',
      `Lesson objectives:\n${input.lessonObjectives}`,
      '',
      `Question he was asked:\n${input.prompt}`,
      '',
      `His answer:\n${input.answer}`,
    ].join('\n'),
    schema: gradeSchema,
  })
}

export async function gradeRecall(input: {
  question: string
  expected: string
  answer: string
}): Promise<GradeResult> {
  const rubric = await loadPrompt('grader')
  return callStructured({
    system: `${rubric}\n\nThis is a spaced-recall card, not a full explain-back: grade the mechanism asked for, not everything he could have said.\n\n${JSON_ONLY} Shape: {"grade":"full"|"partial"|"miss","feedback":string,"missingPieces":string}. Keep feedback to 80 words or fewer.`,
    user: [
      `Question:\n${input.question}`,
      '',
      `Expected answer:\n${input.expected}`,
      '',
      `His answer:\n${input.answer}`,
    ].join('\n'),
    schema: gradeSchema,
  })
}

export async function proposeConceptRows(
  sessionTranscript: string,
): Promise<ConceptProposal[]> {
  const result = await callStructured({
    system: [
      'You read a tutoring session transcript and propose rows for a concept register.',
      '',
      'One row per distinct concept that was actually worked through — not every term mentioned. At most 5 rows, usually 1 or 2, since the sessions are deliberately one concept deep. If nothing was worked through, return an empty array.',
      '',
      'Fields: concept (his own short label), establishedName (the field’s name plus source where you are confident), myVersion (his one-line version, in his words), whereItBreaks (the case his version does not cover), buildLink (the build or project it ties to, or an em dash), status (always "met" for a freshly met concept; use a higher rung only if he demonstrably explained the mechanism back in the transcript).',
      '',
      JSON_ONLY,
      'Shape: {"concepts":[{"concept":string,"establishedName":string,"myVersion":string,"whereItBreaks":string,"buildLink":string,"status":"met"|"explained_back_partial"|"explained_back"|"applied"|"taught"}]}',
    ].join('\n'),
    user: `Transcript:\n\n${sessionTranscript}`,
    schema: conceptProposalsSchema,
  })
  return result.concepts
}

export async function summarizeSession(transcript: string): Promise<string> {
  const result = await callStructured({
    system: [
      'You summarise one tutoring session for the learner’s own records.',
      '',
      'Three to five sentences. State what was covered, where his understanding was solid, where it was thin, and what the next session should pick up. No praise, no hedging, no restating the question list.',
      '',
      `${JSON_ONLY} Shape: {"summary":string}`,
    ].join('\n'),
    user: `Transcript:\n\n${transcript}`,
    schema: summarySchema,
  })
  return result.summary
}

export async function generateRecallQuestion(input: {
  concept: string
  establishedName: string
  myVersion: string
  whereItBreaks: string
}): Promise<RecallQuestion> {
  return callStructured({
    system: [
      'You write one spaced-recall question about a concept the learner has already met.',
      '',
      'Ask for the mechanism, not the label: a question he cannot answer by naming the thing. One question, one sentence. The expected answer is the two or three sentences that would count as a full answer.',
      '',
      `${JSON_ONLY} Shape: {"question":string,"expectedAnswer":string}`,
    ].join('\n'),
    user: [
      `Concept: ${input.concept}`,
      `Established name: ${input.establishedName || '(none recorded)'}`,
      `His version: ${input.myVersion || '(none recorded)'}`,
      `Where it breaks: ${input.whereItBreaks || '(none recorded)'}`,
    ].join('\n'),
    schema: recallQuestionSchema,
  })
}
