"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

const TABS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/plan", label: "Plan", icon: "plan" },
  { href: "/recipes", label: "Recipes", icon: "recipes" },
  { href: "/list", label: "List", icon: "list" },
  { href: "/pantry", label: "Pantry", icon: "pantry" },
  { href: "/more", label: "More", icon: "more" },
];

export function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/share") || path.startsWith("/login")) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((t) => {
          const active = path === t.href || path.startsWith(`${t.href}/`) || (t.href === "/more" && /^\/(stores|settings|history|products)/.test(path));
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-1 pt-2.5 pb-2 text-[10px] font-medium uppercase tracking-[0.12em] ${active ? "text-ink" : "text-muted"}`}
              >
                <Icon name={t.icon} className="h-[22px] w-[22px]" />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
