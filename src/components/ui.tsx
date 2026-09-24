import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none";
export const btn = {
  primary: `${btnBase} bg-accent text-accent-ink hover:opacity-90`,
  secondary: `${btnBase} bg-surface text-ink border border-line hover:bg-surface-2`,
  ghost: `${btnBase} text-ink hover:bg-surface-2`,
  danger: `${btnBase} text-danger border border-line bg-surface hover:bg-surface-2`,
  small: "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium border border-line bg-surface hover:bg-surface-2",
};

export function Button({ variant = "primary", className, ...p }: ComponentProps<"button"> & { variant?: keyof typeof btn }) {
  return <button {...p} className={cx(btn[variant], className)} />;
}

export function LinkButton({ variant = "secondary", className, ...p }: ComponentProps<typeof Link> & { variant?: keyof typeof btn }) {
  return <Link {...p} className={cx(btn[variant], className)} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div {...p} className={cx("rounded-xl border border-line bg-surface p-4", className)} />;
}

export function PageTitle({ children, sub, action }: { children: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
        {sub ? <p className="mt-0.5 text-sm text-muted">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "accent" | "warn" | "smarket" | "lidl" | "danger"; children: ReactNode; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    accent: "bg-accent-soft text-accent",
    warn: "bg-warn-soft text-warn",
    smarket: "bg-smarket-soft text-smarket",
    lidl: "bg-lidl-soft text-lidl",
    danger: "bg-warn-soft text-danger",
  };
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", tones[tone], className)}>{children}</span>;
}

export const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{children}</div>;
}

export function Notice({ tone = "warn", children }: { tone?: "warn" | "accent"; children: ReactNode }) {
  return (
    <div className={cx("rounded-lg px-3 py-2 text-sm", tone === "warn" ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent")}>{children}</div>
  );
}

export function StoreBadge({ storeId }: { storeId: string }) {
  return storeId === "lidl" ? <Badge tone="lidl">Lidl</Badge> : <Badge tone="smarket">S-market</Badge>;
}
