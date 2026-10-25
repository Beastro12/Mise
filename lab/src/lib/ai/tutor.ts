import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import { requireModel } from '@/lib/env'
import { CONCEPT_STATUS_LABELS, type ConceptStatus, type MessageRole } from '@/lib/types'
import { anthropic, MAX_TOKENS } from './client'
import { loadPrompt } from './prompt-files'

export type TutorConcept = {
  concept: string
  establishedName: string
  myVersion: string
  whereItBreaks: string
  status: ConceptStatus
  nextRecallAt: string | null
}

export type TutorContext = {
  module: { code: string; title: string } | null
  lesson: {
    title: string
    order: number
    objectives: string
    preWork: string
    buildExercise: string | null
    bridgePrompt: string
  } | null
  /** Up to 5 concepts due for recall. */
  dueConcepts: TutorConcept[]
  /** The 10 most recently touched concept-log rows. */
  recentConcepts: TutorConcept[]
  mode: 'tutor' | 'placement' | 'free'
}

function conceptLine(c: TutorConcept): string {
  const parts = [
    `- ${c.concept} [${CONCEPT_STATUS_LABELS[c.status]}]`,
    c.establishedName ? `established: ${c.establishedName}` : null,
    c.myVersion ? `his version: ${c.myVersion}` : null,
    c.whereItBreaks ? `breaks: ${c.whereItBreaks}` : null,
  ].filter(Boolean)
  return parts.join(' · ')
}

/**
 * The system prompt, assembled per request: tutor.md, the learner profile,
 * the current module and lesson, up to 5 concepts due for recall, and the 10
 * most recent concept-log rows.
 */
export async function buildSystemPrompt(context: TutorContext): Promise<string> {
  const [tutor, profile] = await Promise.all([
    loadPrompt('tutor'),
    loadPrompt('learner-profile'),
  ])

  const sections: string[] = [tutor, '---', profile, '---']

  if (context.mode === 'placement') {
    sections.push(
      '# This session\n\nA placement session. Probe across the whole course rather than going deep on one concept: find out what he already has and where the gaps are. Still Socratic, still no praise padding.',
    )
  } else if (context.mode === 'free') {
    sections.push(
      '# This session\n\nA free session, not attached to a lesson. He sets the topic. Hold the same standards: mechanism over label, established names, epistemic tags.',
    )
  }

  if (context.lesson && context.module) {
    sections.push(
      [
        '# Current lesson',
        '',
        `Module ${context.module.code} — ${context.module.title}`,
        `Lesson ${context.lesson.order} — ${context.lesson.title}`,
        '',
        `Objectives: ${context.lesson.objectives}`,
        '',
        `Pre-work: ${context.lesson.preWork}`,
        '',
        context.lesson.buildExercise
          ? `Build exercise: ${context.lesson.buildExercise}`
          : 'Build exercise: none for this lesson.',
        '',
        `Bridge to write afterwards: ${context.lesson.bridgePrompt}`,
        '',
        'Teach towards these objectives. The build and the bridge are where this has to land.',
      ].join('\n'),
    )
  }

  if (context.dueConcepts.length > 0) {
    sections.push(
      [
        '# Due for recall',
        '',
        'These are due today. If one fits the thread naturally, ask about it in passing — do not run a quiz.',
        '',
        ...context.dueConcepts.slice(0, 5).map(conceptLine),
      ].join('\n'),
    )
  }

  if (context.recentConcepts.length > 0) {
    sections.push(
      [
        '# Recent concept log',
        '',
        'His own register, most recent first. Use his labels back to him, and correct the ones whose "his version" is wrong.',
        '',
        ...context.recentConcepts.slice(0, 10).map(conceptLine),
      ].join('\n'),
    )
  }

  return sections.join('\n\n')
}

export type TutorTurn = { role: MessageRole; content: string }

/** Streams the tutor reply. Only text blocks are forwarded. */
export async function streamTutorReply(options: {
  system: string
  history: TutorTurn[]
  onText: (delta: string) => void | Promise<void>
}): Promise<string> {
  const client = anthropic()
  const messages: Anthropic.MessageParam[] = options.history.map((turn) => ({
    role: turn.role,
    content: turn.content,
  }))

  const stream = client.messages.stream({
    model: requireModel('tutor'),
    max_tokens: MAX_TOKENS.tutor,
    system: options.system,
    messages,
  })

  let full = ''
  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta' &&
      event.delta.text
    ) {
      full += event.delta.text
      await options.onText(event.delta.text)
    }
  }

  const finalMessage = await stream.finalMessage()
  if (finalMessage.stop_reason === 'refusal') {
    throw new Error(
      'The model declined to answer that. Rephrase the question, or ask it from a different angle.',
    )
  }

  return full
}
