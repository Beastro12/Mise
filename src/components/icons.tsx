/** Aitta line icons: one stroke weight, drawn on a 24px grid, no fills. */
import type { SectionKey } from "@/lib/domain/sections";

const PATHS = {
  plan: "M5 6.5h14V19H5z M5 10.5h14 M9 4v4 M15 4v4",
  recipes: "M12 6.5C10 5.2 7.5 4.8 4 5v13c3.5-.2 6 .2 8 1.5 2-1.3 4.5-1.7 8-1.5V5c-3.5-.2-6 .2-8 1.5z M12 6.5v13",
  list: "M10 7h9 M10 12h9 M10 17h9 M4.5 7l1 1 1.8-2 M4.5 12l1 1 1.8-2 M4.5 17l1 1 1.8-2",
  pantry: "M8.5 3.5h7 M9.5 3.5V6C7.5 6.8 6.5 8.3 6.5 10.5v7.5a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-7.5c0-2.2-1-3.7-3-4.5V3.5 M6.5 12.5h11",
  more: "M6 12h.01 M12 12h.01 M18 12h.01",
  // sections
  hedelmat_vihannekset: "M5 19C5 10.5 10.5 5 19 5c0 8.5-5.5 14-14 14z M5 19l8-8",
  leipa: "M6.5 10.5A3.3 3.3 0 0 1 8.5 4.5h7a3.3 3.3 0 0 1 2 6V19h-11z M10 9.5v2 M14 9.5v2",
  liha_kala: "M4 12c2.5-3.5 6.5-5 10.5-4 2 .5 3.5 2 4.5 4-1 2-2.5 3.5-4.5 4-4 1-8-.5-10.5-4z M4 12 2 9.5 M4 12l-2 2.5 M15.5 11.2v.01",
  maito_juusto: "M9.5 3.5h5 M9.5 3.5V6l-2.5 3.5V20h10V9.5L14.5 6V3.5 M7 13h10",
  kuivatuotteet:
    "M12 20.5V8 M12 8C10 7 9 5.2 9 3c2 0 3 2 3 5z M12 8c2-1 3-2.8 3-5-2 0-3 2-3 5z M12 13c-2-1-3.3-2.5-3.8-4.5 2 .3 3.3 2 3.8 4.5z M12 13c2-1 3.3-2.5 3.8-4.5-2 .3-3.3 2-3.8 4.5z",
  pakasteet: "M12 3v18 M4.2 7.5l15.6 9 M4.2 16.5l15.6-9 M10 4.8l2 2 2-2 M10 19.2l2-2 2 2",
  juomat: "M6 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z M17 10h1.2a2 2 0 0 1 0 4H17 M9.5 3.5v2 M13 3.5v2",
  muut: "M6 12h.01 M12 12h.01 M18 12h.01",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-5 w-5", strokeWidth = 1.4 }: { name: IconName; className?: string; strokeWidth?: number }) {
  const heavy = name === "more" || name === "muut";
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={heavy ? 2.4 : strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

export function SectionIcon({ section, className = "h-3.5 w-3.5" }: { section: SectionKey | string; className?: string }) {
  const name = (section in PATHS ? section : "muut") as IconName;
  return <Icon name={name} className={className} strokeWidth={1.5} />;
}

/** Three birch trunks: the empty-state drawing. */
export function Birches({ className = "h-14 w-20" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 56" className={className} fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden>
      <g strokeWidth={1.4}>
        <path d="M22 54V6 M40 54V14 M58 54V2" />
        <path d="M6 54h68" />
      </g>
      <g strokeWidth={2.2}>
        <path d="M22 14h3 M20 24h2 M22 36h3 M40 22h2 M38 34h3 M40 46h2 M58 10h3 M56 20h2 M58 32h3 M56 44h2" />
      </g>
    </svg>
  );
}
