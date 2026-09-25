import { redirect } from "next/navigation";
import { listPlans } from "@/lib/services/plans";
import { mondayOf, todayHelsinki } from "@/lib/domain/offers";

export const dynamic = "force-dynamic";

/** Home: this week's plan if there is one, else the plan list. */
export default async function Home() {
  const monday = mondayOf(todayHelsinki());
  const plans = await listPlans();
  const current = plans.find((p) => p.weekStart === monday);
  redirect(current ? `/plan/${current.id}` : "/plan");
}
