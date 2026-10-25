/**
 * Every value here is read from the process environment on the server only.
 * The API key is never returned to the browser; `keyStatus()` returns a
 * boolean and nothing else.
 *
 * Model ids live exclusively in the environment (see .env.example). They are
 * deliberately not hardcoded anywhere in the source.
 */

export type EnvProblem = { variable: string; why: string }

export type LabConfig = {
  hasApiKey: boolean
  tutorModel: string
  graderModel: string
  /** True when the tutor and grading features can run. */
  ready: boolean
  problems: EnvProblem[]
}

export function readConfig(): LabConfig {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim()
  const tutorModel = (process.env.LAB_TUTOR_MODEL ?? '').trim()
  const graderModel = (process.env.LAB_GRADER_MODEL ?? '').trim()

  const problems: EnvProblem[] = []
  if (!apiKey) {
    problems.push({
      variable: 'ANTHROPIC_API_KEY',
      why: 'Your Anthropic API key. Without it the tutor and grading cannot run.',
    })
  }
  if (!tutorModel) {
    problems.push({
      variable: 'LAB_TUTOR_MODEL',
      why: 'Model id for the streaming tutor, for example the value in .env.example.',
    })
  }
  if (!graderModel) {
    problems.push({
      variable: 'LAB_GRADER_MODEL',
      why: 'Model id used for grading, summaries and concept proposals.',
    })
  }

  return {
    hasApiKey: apiKey.length > 0,
    tutorModel,
    graderModel,
    ready: problems.length === 0,
    problems,
  }
}

/** The key itself. Server-side callers only; throws when it is missing. */
export function requireApiKey(): string {
  const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim()
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Create .env.local in the project root and add your key.',
    )
  }
  return apiKey
}

export function requireModel(kind: 'tutor' | 'grader'): string {
  const variable = kind === 'tutor' ? 'LAB_TUTOR_MODEL' : 'LAB_GRADER_MODEL'
  const value = (process.env[variable] ?? '').trim()
  if (!value) {
    throw new Error(
      `${variable} is not set. Add it to .env.local (see .env.example for the value to use).`,
    )
  }
  return value
}
