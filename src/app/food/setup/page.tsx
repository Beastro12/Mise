import Link from "next/link";
import { getProfile, latestWeight, listHealth, ouraConfigured } from "@/lib/services/nutrition";
import { saveProfileAction } from "@/app/actions/nutrition";
import { ACTIVITY_LEVELS, bmr, dailyBurn, deficitTarget, estimatedTdee } from "@/lib/domain/nutrition";
import { addDays, todayHelsinki } from "@/lib/domain/offers";
import { HealthImport } from "@/components/health-import";
import { Button, Card, Empty, Field, PageTitle, Section, inputCls } from "@/components/ui";

export const dynamic = "force-dynamic";

const short = (day: string) => {
  const [, m, d] = day.split("-").map(Number);
  return `${d}.${m}.`;
};

export default async function FoodSetupPage() {
  const today = todayHelsinki();
  const [profile, health, weight] = await Promise.all([getProfile(), listHealth(addDays(today, -13), today), latestWeight()]);
  const days = [...new Set(health.map((h) => h.day))];
  const burns = days.map((d) => ({ day: d, rows: health.filter((h) => h.day === d), burn: dailyBurn(health.filter((h) => h.day === d), profile) }));
  const avgBurn = burns.length ? Math.round(burns.reduce((s, b) => s + b.burn.kcal, 0) / burns.length) : estimatedTdee(profile);
  const t = deficitTarget(avgBurn, profile);

  return (
    <div>
      <PageTitle sub="Your profile sets the fallback estimate and the safety limits. Tracker data, when present, decides what you burn.">Calorie setup</PageTitle>

      <Card>
        <form action={saveProfileAction} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sex (for the formula)">
              <select name="sex" defaultValue={profile.sex} className={inputCls}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </Field>
            <Field label="Age">
              <input name="age" inputMode="numeric" defaultValue={profile.age} className={inputCls} />
            </Field>
            <Field label="Height (cm)">
              <input name="heightCm" inputMode="decimal" defaultValue={profile.heightCm} className={inputCls} />
            </Field>
            <Field label="Weight (kg)" hint={weight ? `Latest from tracker: ${weight.kg} kg (${short(weight.day)})` : undefined}>
              <input name="weightKg" inputMode="decimal" defaultValue={profile.saved ? profile.weightKg : (weight?.kg ?? profile.weightKg)} className={inputCls} />
            </Field>
          </div>
          <Field label="Activity (used only without tracker data)">
            <select name="activity" defaultValue={String(profile.activity)} className={inputCls}>
              {ACTIVITY_LEVELS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Daily deficit (kcal)" hint="500 ≈ 0.45 kg a week. Max 1000.">
              <input name="deficitKcal" inputMode="numeric" defaultValue={profile.deficitKcal} className={inputCls} data-testid="deficit" />
            </Field>
            <Field label="Energy burned from">
              <select name="energySource" defaultValue={profile.energySource} className={inputCls}>
                <option value="auto">Apple Health, else Oura</option>
                <option value="apple">Apple Health first</option>
                <option value="oura">Oura first</option>
                <option value="estimate">Profile estimate only</option>
              </select>
            </Field>
          </div>
          <Button type="submit" data-testid="save-profile">
            Save
          </Button>
        </form>
        <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center text-sm">
          <div>
            <dt className="text-xs text-muted">Resting</dt>
            <dd className="font-semibold tabular-nums">{bmr(profile)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Burn / day</dt>
            <dd className="font-semibold tabular-nums">{avgBurn}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Target</dt>
            <dd className="font-semibold tabular-nums">{t.target}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted">
          {burns.length ? `Burn is the average of ${burns.length} day${burns.length === 1 ? "" : "s"} of tracker data.` : "Burn is estimated from the profile (no tracker data in the last 14 days)."}
          {t.limitedBy ? ` Deficit ${t.limitedBy}.` : ""}
        </p>
      </Card>

      <Section title="Apple Health & Oura">
        <Card>
          <HealthImport ouraReady={ouraConfigured()} />
        </Card>
      </Section>

      <Section title="Last 14 days">
        {burns.length === 0 ? (
          <Empty>No tracker data yet. Import a file above.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-3xl bg-surface px-4 py-2 shadow-[0_12px_28px_-22px_rgba(60,40,10,.45)]">
            <table className="w-full text-sm tabular-nums" data-testid="health-table">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-2 font-semibold">Day</th>
                  <th className="font-semibold">Burn</th>
                  <th className="font-semibold">Steps</th>
                  <th className="font-semibold">Used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {burns.map((b) => (
                  <tr key={b.day}>
                    <td className="py-2">{short(b.day)}</td>
                    <td>{b.burn.kcal}</td>
                    <td>{(b.rows.find((r) => r.source === b.burn.source)?.steps ?? b.rows.find((r) => r.steps)?.steps)?.toLocaleString("fi-FI") ?? "–"}</td>
                    <td className="text-xs text-muted">{b.burn.source === "apple" ? "Apple" : b.burn.source === "oura" ? "Oura" : "estimate"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <p className="mt-8 text-sm">
        <Link href="/food" className="underline">
          ← Back to Calories
        </Link>
      </p>
    </div>
  );
}
