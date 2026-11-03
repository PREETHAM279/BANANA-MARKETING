import { PageHeader } from "@/components/PageHeader";
import { Followups } from "@/components/Followups";
import { getLeadList, getSettings } from "@/lib/queries";
import { CLOSED_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Follow-ups" };

export default async function FollowupsPage() {
  const [leads, settings] = await Promise.all([getLeadList(), getSettings()]);
  const { prisma } = await import("@/lib/db");
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const withMeetings = await prisma.business.findMany({ where: { meetingAt: { gte: local }, status: { notIn: CLOSED_STATUSES } }, select: { id: true, meetingAt: true }, orderBy: { meetingAt: "asc" } });
  const meetings = withMeetings.map((m) => ({ ...leads.find((l) => l.id === m.id)!, meetingAt: m.meetingAt as string })).filter((m) => m.id);
  return (
    <>
      <PageHeader title="Follow-ups" subtitle="Everything you promised to come back to - overdue first." />
      <Followups leads={leads.filter((l) => l.followUpDate)} settings={settings} meetings={meetings} />
    </>
  );
}
