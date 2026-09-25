"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AittaMark } from "./logo";

const SEASONS = ["Talvi", "Talvi", "Kevät", "Kevät", "Kevät", "Kesä", "Kesä", "Kesä", "Syksy", "Syksy", "Syksy", "Talvi"];

function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7);
}

/** Spruce header band: wordmark + the season and week you're planning in. */
export function TopBar() {
  const path = usePathname();
  if (path.startsWith("/login")) return null;
  const shared = path.startsWith("/share");
  const now = new Date();
  const inner = (
    <span className="flex items-center gap-2">
      <AittaMark className="h-5 w-5 text-chanterelle" />
      <span className="font-display text-[22px] font-[700] lowercase tracking-[-0.02em]">aitta</span>
    </span>
  );
  return (
    <header className="bg-[#1f3b2e] text-[#f7f1e6]">
      <div className="mx-auto flex max-w-xl items-center justify-between px-5 pt-[max(env(safe-area-inset-top),16px)] pb-4">
        {shared ? inner : <Link href="/">{inner}</Link>}
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold" suppressHydrationWarning>
          {SEASONS[now.getMonth()]} · viikko {isoWeek(now)}
        </span>
      </div>
    </header>
  );
}
