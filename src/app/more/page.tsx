import Link from "next/link";
import { aiAvailable } from "@/lib/ai/client";
import { config } from "@/lib/env";
import { getSKaupatAdapter } from "@/lib/stores";
import { authEnabled } from "@/lib/auth";
import { Badge, PageTitle, Section } from "@/components/ui";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/stores", title: "Stores & section order", sub: "S-market store, walking order per store" },
  { href: "/stores/lidl", title: "Lidl offers", sub: "Import this week's leaflet (photo or text)" },
  { href: "/products", title: "Product matches", sub: "Ingredient → S-kaupat product" },
  { href: "/settings", title: "Staples & store rules", sub: '"Have it?" staples, "always buy X at Lidl"' },
  { href: "/settings/synonyms", title: "Ingredient synonyms", sub: "English / inflected names → Finnish" },
  { href: "/history", title: "Cooking history", sub: "Meals marked as cooked" },
];

export default function MorePage() {
  const adapter = getSKaupatAdapter();
  return (
    <div>
      <PageTitle>More</PageTitle>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="block px-4 py-3 hover:bg-surface-2">
              <div className="font-medium">{l.title}</div>
              <div className="text-xs text-muted">{l.sub}</div>
            </Link>
          </li>
        ))}
      </ul>
      <Section title="Status">
        <dl className="space-y-1.5 rounded-xl border border-line bg-surface p-4 text-sm">
          <div className="flex justify-between gap-2">
            <dt>Database</dt>
            <dd>{process.env.DATABASE_URL ? "Postgres (DATABASE_URL)" : "Local PGlite (.data/)"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Claude</dt>
            <dd>{aiAvailable() ? <Badge tone="accent">{config.anthropicModel}</Badge> : <Badge tone="warn">not configured</Badge>}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>S-kaupat data</dt>
            <dd className="text-right">
              <Badge tone={adapter.status === "VERIFIED" ? "accent" : "warn"}>{adapter.status}</Badge>
              <div className="text-xs text-muted">{adapter.description}</div>
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Lidl offers</dt>
            <dd className="text-right text-xs text-muted">From your leaflet imports (lidl.fi not verified)</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Passcode</dt>
            <dd>{authEnabled() ? "on" : <Badge tone="warn">off</Badge>}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>File storage</dt>
            <dd>{config.blobStore === "supabase" ? "Supabase Storage" : "Local (.data/uploads)"}</dd>
          </div>
        </dl>
      </Section>
    </div>
  );
}
