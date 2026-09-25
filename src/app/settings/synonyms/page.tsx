import { listSynonyms } from "@/lib/services/vocab";
import { deleteSynonymAction, upsertSynonymAction } from "@/app/actions/stores";
import { SECTIONS } from "@/lib/domain/sections";
import { Badge, Button, Card, Field, PageTitle, Section, btn, cx, inputCls } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SynonymsPage(props: PageProps<"/settings/synonyms">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const rows = await listSynonyms(q);
  const shown = rows.slice(0, 200);
  return (
    <div>
      <PageTitle sub="How ingredient names (any language or inflection) map to the Finnish name used for shopping.">Synonyms</PageTitle>
      <Card>
        <form action={upsertSynonymAction} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Term as written">
              <input name="term" required placeholder="sour cream" className={inputCls} />
            </Field>
            <Field label="Finnish name">
              <input name="nameFi" required placeholder="kermaviili" className={inputCls} />
            </Field>
          </div>
          <Field label="Section">
            <select name="category" className={inputCls} defaultValue="">
              <option value="">(keep / unknown)</option>
              {SECTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.fi}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit">Save synonym</Button>
        </form>
      </Card>
      <Section title={`${rows.length} synonyms`}>
        <form className="mb-2">
          <input name="q" defaultValue={q} placeholder="Filter" className={inputCls} />
        </form>
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
          {shown.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
              <span className="min-w-0 truncate">
                {r.term} → <span className="font-medium">{r.nameFi}</span> {r.source !== "seed" ? <Badge>{r.source}</Badge> : null}
              </span>
              <form action={deleteSynonymAction}>
                <input type="hidden" name="id" value={r.id} />
                <button className={cx(btn.small, "text-danger")}>✕</button>
              </form>
            </li>
          ))}
        </ul>
        {rows.length > shown.length ? <p className="mt-2 text-xs text-muted">Showing 200; filter to find more.</p> : null}
      </Section>
    </div>
  );
}
