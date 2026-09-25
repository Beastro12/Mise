import { ImportTabs } from "@/components/import-tabs";
import { PageTitle } from "@/components/ui";
import { aiAvailable } from "@/lib/ai/client";

export const dynamic = "force-dynamic";
// Claude extraction of several pages can take a while (server actions inherit this).
export const maxDuration = 300;

export default function ImportPage() {
  return (
    <div>
      <PageTitle sub="Every import ends in a review screen before anything is saved.">Add recipe</PageTitle>
      <ImportTabs aiReady={aiAvailable()} />
    </div>
  );
}
