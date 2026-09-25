"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-server";
import { createHelperKey, revokeHelperKey } from "@/lib/helper-auth";

/** Returns the new key once; only its hash is stored. Replaces any previous key. */
export async function createHelperKeyAction(): Promise<{ key: string }> {
  await requireAuth();
  const key = await createHelperKey();
  revalidatePath("/delivery");
  return { key };
}

export async function revokeHelperKeyAction(): Promise<void> {
  await requireAuth();
  await revokeHelperKey();
  revalidatePath("/delivery");
}
