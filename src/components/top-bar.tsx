"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AittaMark } from "./logo";

export function TopBar() {
  const path = usePathname();
  if (path.startsWith("/login")) return null;
  const shared = path.startsWith("/share");
  const inner = (
    <span className="flex items-center gap-2 text-accent">
      <AittaMark className="h-[18px] w-[18px]" />
      <span className="text-[15px] font-semibold tracking-[0.08em] text-ink">AITTA</span>
    </span>
  );
  return (
    <header className="mx-auto flex max-w-xl items-center justify-between px-5 pt-[max(env(safe-area-inset-top),14px)] pb-1">
      {shared ? inner : <Link href="/">{inner}</Link>}
      <span className="text-[11px] tracking-[0.12em] text-muted uppercase">Turku</span>
    </header>
  );
}
