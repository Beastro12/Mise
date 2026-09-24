import { ImportTabs } from "@/components/import-tabs";
import { PageTitle } from "@/components/ui";
import { aiAvailable } from "@/lib/ai/client";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <div>
      <PageTitle sub="Every import ends in a review screen before anything is saved.">Add recipe</PageTitle>
      <ImportTabs aiReady={aiAvailable()} />
    </div>
  );
}
