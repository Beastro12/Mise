import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * The prompts live in prompts/*.md and are read on every request, so they can
 * be edited while the app is running without a restart or a code change.
 */
export type PromptName = 'tutor' | 'learner-profile' | 'grader'

export async function loadPrompt(name: PromptName): Promise<string> {
  const path = join(process.cwd(), 'prompts', `${name}.md`)
  try {
    return (await readFile(path, 'utf8')).trim()
  } catch {
    throw new Error(
      `Could not read prompts/${name}.md. The file is part of the project; restore it from git or re-create it.`,
    )
  }
}
