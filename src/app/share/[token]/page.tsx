import { notFound } from "next/navigation";
import { getListByToken } from "@/lib/services/lists";
import { toClientList } from "@/lib/services/client-list";
import { Checklist } from "@/components/checklist";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SharedListPage(props: PageProps<"/share/[token]">) {
  const { token } = await props.params;
  const data = await getListByToken(token);
  if (!data) notFound();
  return (
    <div>
      <PageTitle sub="Shared list: check-offs sync with the other phone.">{data.list.name}</PageTitle>
      <Checklist initial={toClientList(data, false)} mode="share" token={token} />
    </div>
  );
}
