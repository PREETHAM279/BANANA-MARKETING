import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getLeadDetail, getSettings, integrationStatus } from "@/lib/queries";
import { ProfileClient } from "@/components/profile/ProfileClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await prisma.business.findUnique({ where: { id }, select: { name: true } });
  return { title: b?.name ?? "Lead" };
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadDetail(id);
  if (!lead) notFound();
  const [settings, prev, next] = await Promise.all([
    getSettings(),
    prisma.business.findFirst({ where: { priorityRank: { lt: lead.priorityRank } }, orderBy: { priorityRank: "desc" }, select: { id: true } }),
    prisma.business.findFirst({ where: { priorityRank: { gt: lead.priorityRank } }, orderBy: { priorityRank: "asc" }, select: { id: true } }),
  ]);
  const integ = integrationStatus();
  return <ProfileClient initial={lead} settings={settings} integrations={{ googlePlaces: integ.googlePlaces, smtp: integ.smtp }} prevId={prev?.id ?? null} nextId={next?.id ?? null} />;
}
