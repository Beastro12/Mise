import { cookies } from "next/headers";
import { SESSION_COOKIE, authEnabled, verifySession } from "./auth";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

/** Call at the top of every server action / route handler that needs the owner. */
export async function requireAuth(): Promise<void> {
  if (!authEnabled()) return;
  const jar = await cookies();
  if (!verifySession(jar.get(SESSION_COOKIE)?.value)) throw new UnauthorizedError();
}
