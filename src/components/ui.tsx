import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Mushroom } from "./icons";

export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition active:scale-[.97] disabled:opacity-40 disabled:pointer-events-none";
export const btn = {
  primary: `${btnBase} bg-primary text-primary-ink hover:bg-primary-strong`,
  secondary: `${btnBase} bg-surface text-ink border border-line shadow-[0_1px_0_rgba(0,0,0,.04)] hover:bg-surface-2`,
  harvest: `${btnBase} bg-chanterelle text-chanterelle-ink hover:bg-chanterelle-strong shadow-[0_6px_16px_-8px_rgba(207,139,28,.8)]`,
  ghost: `${btnBase} text-ink hover:bg-surface-2`,
  danger: `${btnBase} text-danger border border-lingon/30 bg-surface hover:bg-lingon-soft`,
  quiet: "rounded-full px-2.5 py-1 text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40",
  small: "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border border-line bg-surface text-ink hover:bg-surface-2 disabled:opacity-40",
};

export function Button({ variant = "primary", className, ...p }: ComponentProps<"button"> & { variant?: keyof typeof btn }) {
  return <button {...p} className={cx(btn[variant], className)} />;
}

export function LinkButton({ variant = "secondary", className, ...p }: ComponentProps<typeof Link> & { variant?: keyof typeof btn }) {
  return <Link {...p} className={cx(btn[variant], className)} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div {...p} className={cx("rounded-3xl bg-surface p-5 shadow-[0_1px_0_rgba(60,40,10,.05),0_12px_28px_-20px_rgba(60,40,10,.35)]", className)} />;
}

export function PageTitle({ children, sub, action }: { children: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-[34px] font-[650] leading-[1.05] tracking-[-0.025em] text-primary">{children}</h1>
        {sub ? <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-muted">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-[20px] font-[620] tracking-[-0.01em]">{title}</h2>
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
  "w-full rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-4 focus:ring-chanterelle/25";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-surface-2/60 px-6 py-10 text-center text-sm text-muted">
      <Mushroom className="h-16 w-16" />
      <div className="max-w-[30ch] leading-relaxed">{children}</div>
    </div>
  );
}

export function Notice({ tone = "warn", children }: { tone?: "warn" | "accent"; children: ReactNode }) {
  return (
    <div className={cx("rounded-2xl border px-3.5 py-2.5 text-sm", tone === "warn" ? "border-warn/20 bg-warn-soft text-warn" : "border-accent/20 bg-accent-soft text-accent")}>{children}</div>
  );
}

export function StoreBadge({ storeId }: { storeId: string }) {
  return storeId === "lidl" ? <Badge tone="lidl">Lidl</Badge> : <Badge tone="smarket">S-market</Badge>;
}
