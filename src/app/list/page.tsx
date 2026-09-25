import Link from "next/link";
import { redirect } from "next/navigation";
import { listLists } from "@/lib/services/lists";
import { Empty, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  const lists = await listLists();
  if (lists.length === 1) redirect(`/list/${lists[0].id}`);
  return (
    <div>
      <PageTitle>Shopping lists</PageTitle>
      {lists.length === 0 ? (
        <Empty>
          No list yet. <Link className="underline" href="/plan">Plan some meals</Link> and generate one.
        </Empty>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {lists.map((l) => (
            <li key={l.id}>
              <Link href={`/list/${l.id}`} className="flex justify-between px-1 py-3.5 hover:bg-surface-2">
                <span className="font-medium">{l.name}</span>
                <span className="text-xs text-muted">{l.updatedAt.toLocaleDateString("fi-FI")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
