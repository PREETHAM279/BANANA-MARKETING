import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Directory } from "@/components/Directory";
import { getLeadList } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Directory" };

export default async function LeadsPage() {
  const leads = await getLeadList();
  return (
    <>
      <PageHeader
        title="Business directory"
        subtitle="100 researched Bengaluru prospects. Filters are remembered when you open a profile and come back."
      />
      <Suspense fallback={<div className="card p-6 text-sm text-muted">Loading…</div>}>
        <Directory leads={leads} />
      </Suspense>
    </>
  );
}
