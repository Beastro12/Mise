"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/plan", label: "Plan", icon: "M4 5h16M4 12h16M4 19h10" },
  { href: "/recipes", label: "Recipes", icon: "M6 4h9l3 3v13H6zM9 10h6M9 14h6" },
  { href: "/list", label: "List", icon: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" },
  { href: "/pantry", label: "Pantry", icon: "M5 4h14v6H5zM5 10h14v10H5zM10 7h4M10 14h4" },
  { href: "/more", label: "More", icon: "M5 12h.01M12 12h.01M19 12h.01" },
];

export function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/share") || path.startsWith("/login")) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((t) => {
          const active = path === t.href || path.startsWith(`${t.href}/`) || (t.href === "/more" && /^\/(stores|settings|history|products)/.test(path));
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? "text-accent" : "text-muted"}`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={t.label === "More" ? 3 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={t.icon} />
                </svg>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
