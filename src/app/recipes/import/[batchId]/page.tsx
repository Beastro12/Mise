import { notFound } from "next/navigation";
import { getBatch } from "@/lib/services/imports";
import { RecipeEditor } from "@/components/recipe-editor";
import { LinkButton, Notice, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";
// Claude extraction of several pages can take a while (server actions inherit this).
export const maxDuration = 300;

export default async function ReviewPage(props: PageProps<"/recipes/import/[batchId]">) {
  const { batchId } = await props.params;
  const data = await getBatch(batchId);
  if (!data) notFound();
  const { batch, drafts, originals } = data;
  const images = originals.filter((o) => o.kind === "image");
  const files = originals.filter((o) => o.kind === "file");
  const urls = originals.filter((o) => o.kind === "url");
  return (
    <div>
      <PageTitle
        sub={`${drafts.length} draft${drafts.length === 1 ? "" : "s"} from ${batch.kind}. Fix anything, then save each one.`}
        action={<LinkButton href="/recipes">Done</LinkButton>}
      >
        Review import
      </PageTitle>
      {batch.message ? (
        <div className="mb-3">
          <Notice>{batch.message}</Notice>
        </div>
      ) : null}
      {images.length || files.length || urls.length ? (
        <div className="mb-4">
          <div className="mb-1 text-xs font-bold text-primary">Originals</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((o) => (
              <a key={o.id} href={`/api/originals/${o.id}`} target="_blank" rel="noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/originals/${o.id}`} alt={o.filename ?? "page"} className="h-28 rounded-lg border border-line object-cover" />
              </a>
            ))}
            {files.map((o) => (
              <a key={o.id} href={`/api/originals/${o.id}`} target="_blank" rel="noreferrer" className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                📄 {o.filename}
              </a>
            ))}
            {urls.map((o) => (
              <a key={o.id} href={o.url!} target="_blank" rel="noreferrer" className="truncate rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                🔗 {o.url}
              </a>
            ))}
          </div>
        </div>
      ) : null}
      <div className="space-y-3">
        {drafts.map((d, i) => (
          <RecipeEditor key={d.id} index={i} initial={d.draft} mode={{ kind: "draft", draftId: d.id, status: d.status, recipeId: d.recipeId }} />
        ))}
      </div>
    </div>
  );
}
