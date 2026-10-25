// Shared string unions. No imports: the rules engine and the zod schemas both
// depend on this file, and neither should pull in the database driver.

export const MODULE_SIZES = ['full', 'short'] as const
export const PROGRESS_STATUSES = ['not_started', 'in_progress', 'complete'] as const
export const CONCEPT_STATUSES = [
  'met',
  'explained_back_partial',
  'explained_back',
  'applied',
  'taught',
] as const
export const SESSION_MODES = ['tutor', 'placement', 'free'] as const
export const MESSAGE_ROLES = ['user', 'assistant'] as const
export const GRADES = ['full', 'partial', 'miss'] as const
export const BUILD_STATUSES = ['planned', 'predicted', 'done'] as const
export const BRIDGE_LANGUAGES = ['en', 'fi'] as const
export const PARKING_STATUSES = ['open', 'promoted', 'dropped'] as const
export const SOURCE_KINDS = ['video', 'paper', 'post', 'book', 'docs', 'regulation'] as const
export const READ_STATUSES = ['unread', 'reading', 'done'] as const
export const COMPLETION_ENTITY_TYPES = ['lesson', 'module'] as const

export type ModuleSize = (typeof MODULE_SIZES)[number]
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number]
export type ConceptStatus = (typeof CONCEPT_STATUSES)[number]
export type SessionMode = (typeof SESSION_MODES)[number]
export type MessageRole = (typeof MESSAGE_ROLES)[number]
export type Grade = (typeof GRADES)[number]
export type BuildStatus = (typeof BUILD_STATUSES)[number]
export type BridgeLanguage = (typeof BRIDGE_LANGUAGES)[number]
export type ParkingStatus = (typeof PARKING_STATUSES)[number]
export type SourceKind = (typeof SOURCE_KINDS)[number]
export type ReadStatus = (typeof READ_STATUSES)[number]
export type CompletionEntityType = (typeof COMPLETION_ENTITY_TYPES)[number]

/** The five steps of the learning loop, in order, as shown on a lesson. */
export const LOOP_STEPS = ['prework', 'session', 'build', 'explain_back', 'bridge'] as const
export type LoopStep = (typeof LOOP_STEPS)[number]

export const LOOP_STEP_LABELS: Record<LoopStep, string> = {
  prework: 'Pre-work',
  session: 'Session',
  build: 'Build',
  explain_back: 'Explain-back',
  bridge: 'Bridge',
}

export const CONCEPT_STATUS_LABELS: Record<ConceptStatus, string> = {
  met: 'Met',
  explained_back_partial: 'Partial',
  explained_back: 'Explained back',
  applied: 'Applied',
  taught: 'Taught',
}

export const GRADE_LABELS: Record<Grade, string> = {
  full: 'Full',
  partial: 'Partial',
  miss: 'Miss',
}

/** Evidence recorded on a completionEvents row. */
export type CompletionEvidence = {
  explainBackIds: string[]
  buildId: string | null
  bridgeId: string | null
  recallIds?: string[]
  lessonIds?: string[]
}
