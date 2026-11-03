import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Communication } from "@/components/Communication";
import { getLeadList, getRecentActivities, getSettings, integrationStatus } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Communication" };

export default async function CommunicationPage() {
  const [leads, activities, settings] = await Promise.all([getLeadList(), getRecentActivities(500, ["CALL", "WHATSAPP", "EMAIL", "MEETING", "VISIT"]), getSettings()]);
  return (
    <>
      <PageHeader title="Communication centre" subtitle="Calls, WhatsApp and email - generated for each business, logged only when you confirm." />
      <Suspense fallback={null}>
        <Communication leads={leads} activities={activities} settings={settings} smtp={integrationStatus().smtp} />
      </Suspense>
    </>
  );
}
