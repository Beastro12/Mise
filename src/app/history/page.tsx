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
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {rows.map(({ meal, recipe }) => (
            <li key={meal.id} className="flex justify-between px-4 py-2.5">
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
