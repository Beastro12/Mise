import Link from "next/link";
import { cookHistory } from "@/lib/services/plans";
import { Empty, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const rows = await cookHistory();
  return (
    <div>
      <PageTitle sub="Meals marked as cooked. Propose mode avoids anything from the last 2 weeks.">History</PageTitle>
      {rows.length === 0 ? (
        <Empty>Nothing cooked yet. Mark meals as cooked on the plan page.</Empty>
      ) : (
        <ul className="divide-y divide-line rounded-3xl bg-surface px-4 shadow-[0_12px_28px_-22px_rgba(60,40,10,.45)]">
          {rows.map(({ meal, recipe }) => (
            <li key={meal.id} className="flex justify-between px-1 py-3">
              <Link href={`/recipes/${recipe.id}`} className="font-medium hover:underline">
                {recipe.title}
              </Link>
              <span className="text-sm text-muted tabular">{meal.cookedAt!.toLocaleDateString("fi-FI")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
