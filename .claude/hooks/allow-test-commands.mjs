// PreToolUse hook for the `tests` subagent: only the approved test commands may run.
import { readFileSync } from "node:fs";

const ALLOWED = [
  /^npm test$/,
  /^npm run (typecheck|lint|test:e2e)$/,
  /^npx next typegen$/,
  /^npx vitest run( tests\/unit\/[\w./-]+\.test\.ts)*$/,
];

const input = JSON.parse(readFileSync(0, "utf8"));
const command = String(input.tool_input?.command ?? "").trim();
if (!ALLOWED.some((re) => re.test(command))) {
  console.error(`Blocked: the tests agent may only run npm test, npx vitest run <tests/unit files>, npx next typegen, npm run typecheck|lint|test:e2e. Got: ${command}`);
  process.exit(2);
}
