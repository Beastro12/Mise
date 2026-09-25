import "server-only";
import { NextResponse } from "next/server";
import { requireAuth, UnauthorizedError } from "./auth-server";

/** Wrap a route handler: owner auth + JSON errors. */
export async function ownerRoute(fn: () => Promise<Response>): Promise<Response> {
  try {
    await requireAuth();
    return await fn();
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("[api]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function publicRoute(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    console.error("[api]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export const noStore = { headers: { "cache-control": "no-store" } };
