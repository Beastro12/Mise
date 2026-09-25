import { notFound } from "next/navigation";
import { getList } from "@/lib/services/lists";
import { toClientList } from "@/lib/services/client-list";
import { Checklist } from "@/components/checklist";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ListPage(props: PageProps<"/list/[id]">) {
  const { id } = await props.params;
  const data = await getList(id);
  if (!data) notFound();
  return (
    <div>
      <PageTitle sub="Tap to check off. Works offline in the store.">{data.list.name}</PageTitle>
      <Checklist initial={toClientList(data, true)} mode="owner" />
    </div>
  );
}
