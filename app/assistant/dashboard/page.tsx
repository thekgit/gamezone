import { redirect } from "next/navigation";
import { assertAssistant } from "@/lib/assertAssistant";
import AssistantVisitorsClient from "./AssistantVisitorsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AssistantDashboardPage() {
  const ok = await assertAssistant();
  if (!ok) redirect("/assistant");
  return <AssistantVisitorsClient />;
}