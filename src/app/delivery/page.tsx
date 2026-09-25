import { headers } from "next/headers";
import { getDeliveryPrefs } from "@/lib/services/settings";
import { listLists } from "@/lib/services/lists";
import { deliveryPrefsAction } from "@/app/actions/stores";
import { Button, Card, Field, Notice, PageTitle, Section, inputCls } from "@/components/ui";

export const dynamic = "force-dynamic";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function DeliveryPage() {
  const [prefs, lists] = await Promise.all([getDeliveryPrefs(), listLists()]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const latest = lists[0];
  const command = latest ? `npm run cart -- "${origin}/share/${latest.shareToken}"` : null;
  return (
    <div>
      <PageTitle sub="Aitta fills your S-kaupat cart from your Mac and picks the delivery slot. You log in and press order yourself.">
        S-kaupat order
      </PageTitle>

      <Card>
        <form action={deliveryPrefsAction} className="space-y-3">
          <Field label="Receive by">
            <select name="mode" defaultValue={prefs.mode} className={inputCls}>
              <option value="home">Home delivery</option>
              <option value="pickup">Store pickup</option>
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Preferred day">
              <select name="weekday" defaultValue={prefs.weekday} className={inputCls}>
                {DAYS.map((d, i) => (
                  <option key={d} value={i + 1}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="From">
              <input name="windowStart" defaultValue={prefs.windowStart} className={inputCls} />
            </Field>
            <Field label="To">
              <input name="windowEnd" defaultValue={prefs.windowEnd} className={inputCls} />
            </Field>
          </div>
          <Field label="If a product is sold out">
            <select name="substitutions" defaultValue={prefs.substitutions} className={inputCls}>
              <option value="alternate">Use my 2nd choice, then tell me</option>
              <option value="none">Skip it and tell me</option>
              <option value="store">Leave it to S-kaupat&apos;s own replacement setting</option>
            </select>
          </Field>
          <Button type="submit">Save preferences</Button>
        </form>
      </Card>

      <Section title="Run it on your Mac">
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          <li>Once: install Node.js 22 and Google Chrome, clone this repo, and run <code className="rounded bg-surface-2 px-1">npm install</code>.</li>
          <li>Plan the week and generate the shopping list. Match S-market products (and 2nd choices) for the ingredients.</li>
          <li>
            In the repo folder run:
            {command ? (
              <pre className="mt-1.5 overflow-x-auto rounded-2xl bg-primary p-3 text-xs text-primary-ink" data-testid="cart-command">
                {command}
              </pre>
            ) : (
              <span className="text-muted"> (generate a shopping list first)</span>
            )}
          </li>
          <li>Chrome opens S-kaupat. Log in yourself; Aitta adds the products, then picks your delivery slot.</li>
          <li>It stops before ordering. Check the cart, then press the order button yourself.</li>
        </ol>
        <div className="mt-4">
          <Notice>
            The S-kaupat steps are unverified: s-kaupat.fi couldn&apos;t be opened when this was built. When a step doesn&apos;t work, the helper pauses and asks you to
            do that one step by hand, then carries on. Check S-kaupat&apos;s terms of use before automating your account.
          </Notice>
        </div>
      </Section>
    </div>
  );
}
