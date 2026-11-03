import { PageHeader } from "@/components/PageHeader";
import { Pipeline } from "@/components/Pipeline";
import { getLeadList } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const leads = await getLeadList();
  return (
    <>
      <PageHeader title="Sales pipeline" subtitle="Every lead in one of 12 stages. Changes save automatically and appear in each lead's timeline." />
      <Pipeline leads={leads} />
    </>
  );
}
