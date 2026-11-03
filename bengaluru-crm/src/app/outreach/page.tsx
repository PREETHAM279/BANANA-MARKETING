import { PageHeader } from "@/components/PageHeader";
import { Outreach } from "@/components/Outreach";
import { prisma } from "@/lib/db";
import { getLeadList, getSettings, integrationStatus } from "@/lib/queries";
import { addDays, todayISO } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tomorrow's Outreach" };

export default async function OutreachPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : addDays(todayISO(), 1);
  const [leads, settings, tasks, dayNote] = await Promise.all([
    getLeadList(),
    getSettings(),
    prisma.outreachTask.findMany({ where: { date } }),
    prisma.dayNote.findUnique({ where: { date } }),
  ]);
  return (
    <>
      <PageHeader
        title="Tomorrow's Outreach"
        subtitle="All 100 prospects in a recommended calling order, grouped into time blocks. Tick them off as you go - progress is saved per day."
      />
      <Outreach
        leads={leads}
        date={date}
        tasks={tasks.map((t) => ({ businessId: t.businessId, done: t.done, note: t.note, skipped: t.skipped, doneAt: t.doneAt ? t.doneAt.toISOString() : null }))}
        dayNote={dayNote?.content ?? ""}
        settings={settings}
        smtp={integrationStatus().smtp}
      />
    </>
  );
}
