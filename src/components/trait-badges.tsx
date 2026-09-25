import type { Effort, Protein, RecipeTraits } from "@/lib/domain/traits";
import { EFFORT_LABEL, PROTEIN_LABEL } from "@/lib/domain/traits";
import { Icon } from "./icons";
import { cx } from "./ui";

const PROTEIN_TONE: Record<Protein, string> = {
  meat: "bg-lingon-soft text-lingon",
  chicken: "bg-chanterelle-soft text-chanterelle-deep",
  fish: "bg-lidl-soft text-lidl",
  vegetarian: "bg-smarket-soft text-smarket",
  vegan: "bg-accent-soft text-primary",
};

export function ProteinIcon({ protein, className = "h-4 w-4" }: { protein: Protein; className?: string }) {
  return <Icon name={protein} className={className} strokeWidth={1.8} />;
}

/** Protein chip (icon + word) followed by small effort icons. */
export function TraitBadges({ traits, compact = false, className }: { traits: RecipeTraits; compact?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex flex-wrap items-center gap-1", className)} data-testid="traits" data-protein={traits.protein}>
      <span
        className={cx("inline-flex items-center gap-1 rounded-full font-semibold", compact ? "p-1" : "px-2 py-0.5 text-[11px]", PROTEIN_TONE[traits.protein])}
        title={PROTEIN_LABEL[traits.protein]}
      >
        <ProteinIcon protein={traits.protein} className={compact ? "h-3.5 w-3.5" : "h-3.5 w-3.5"} />
        {compact ? <span className="sr-only">{PROTEIN_LABEL[traits.protein]}</span> : PROTEIN_LABEL[traits.protein]}
      </span>
      {traits.effort.map((e: Effort) => (
        <span key={e} className="inline-flex items-center gap-1 rounded-full bg-surface-2 p-1 text-muted" title={EFFORT_LABEL[e]}>
          <Icon name={e} className="h-3.5 w-3.5" strokeWidth={1.8} />
          <span className="sr-only">{EFFORT_LABEL[e]}</span>
        </span>
      ))}
    </span>
  );
}
