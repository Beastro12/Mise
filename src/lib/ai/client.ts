import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../env";

export class AiUnavailableError extends Error {
  constructor() {
    super("Claude is not configured: set ANTHROPIC_API_KEY on the server.");
  }
}

/** The subset of the SDK the app uses; lets tests inject a stub. */
export type MessagesParser = Pick<Anthropic["messages"], "parse">;

let client: Anthropic | null = null;
let override: MessagesParser | null = null;

export function aiAvailable(): boolean {
  return !!override || !!config.anthropicKey;
}

export function getMessages(): MessagesParser {
  if (override) return override;
  if (!config.anthropicKey) throw new AiUnavailableError();
  client ??= new Anthropic({ apiKey: config.anthropicKey });
  return client.messages;
}

/** Test hook. */
export function __setMessagesForTests(m: MessagesParser | null) {
  override = m;
}

/** Turn SDK errors into a short message for the UI. */
export function describeAiError(err: unknown): string {
  if (err instanceof AiUnavailableError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return "Claude rejected the API key (check ANTHROPIC_API_KEY).";
  if (err instanceof Anthropic.RateLimitError) return "Claude is rate limited right now. Try again in a minute.";
  if (err instanceof Anthropic.BadRequestError) return `Claude could not process this input: ${err.message}`;
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status ?? ""}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}
