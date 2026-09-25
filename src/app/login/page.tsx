import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE, authEnabled, checkPasscode, signSession } from "@/lib/auth";
import { Button, Card, Field, inputCls } from "@/components/ui";
import { AittaMark } from "@/components/logo";

export const dynamic = "force-dynamic";

function safeNext(v: unknown): string {
  const s = typeof v === "string" ? v : "/";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

async function login(formData: FormData) {
  "use server";
  const next = safeNext(formData.get("next"));
  if (!checkPasscode(String(formData.get("passcode") ?? ""))) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  redirect(next);
}

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  if (!authEnabled()) redirect("/");
  return (
    <div className="mx-auto mt-20 max-w-sm">
      <AittaMark className="mb-6 h-10 w-10 text-ink" />
      <h1 className="font-display text-[40px] font-[380] lowercase leading-none tracking-[0.01em]">aitta</h1>
      <p className="mt-2 mb-8 text-sm text-muted">Meal planner · S-market + Lidl Vähäheikkilä</p>
      <Card>
        <form action={login} className="space-y-4">
          <input type="hidden" name="next" value={safeNext(sp.next)} />
          <Field label="Passcode">
            <input name="passcode" type="password" autoFocus autoComplete="current-password" className={inputCls} />
          </Field>
          {sp.error ? <p className="text-sm text-danger">Wrong passcode.</p> : null}
          <Button type="submit" className="w-full">
            Open
          </Button>
        </form>
      </Card>
    </div>
  );
}
