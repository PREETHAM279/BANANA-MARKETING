import "server-only";
import { prisma } from "./db";
import { CATEGORIES, CLOSED_STATUSES, INTERESTED_STATUSES, NOT_CONTACTED_STATUSES, STATUSES, ZONES } from "./constants";
import { addDays, isoDate, todayISO } from "./format";
import { toActivity, toListItem } from "./serialize";

export async function getDashboard() {
  const today = todayISO();
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 13);

  const [businesses, actCounts, recentActs, windowActs] = await Promise.all([
    prisma.business.findMany({ orderBy: { priorityRank: "asc" }, include: { photos: { take: 1, orderBy: { createdAt: "asc" } } } }),
    prisma.activity.groupBy({ by: ["type", "outcome"], _count: { _all: true } }),
    prisma.activity.findMany({ where: { type: { notIn: ["SYSTEM"] } }, orderBy: { occurredAt: "desc" }, take: 12, include: { business: { select: { name: true } } } }),
    prisma.activity.findMany({ where: { occurredAt: { gte: since }, type: { in: ["CALL", "WHATSAPP", "EMAIL", "MEETING", "VISIT"] } }, select: { type: true, outcome: true, occurredAt: true } }),
  ]);
  const leads = businesses.map(toListItem);

  const count = (type: string, pred: (o: string) => boolean = () => true) => actCounts.filter((a) => a.type === type && pred(a.outcome)).reduce((s, a) => s + a._count._all, 0);
  const sentPred = (o: string) => o !== "No reply yet" && o !== "Bounced" && o !== "";

  const contacted = leads.filter((l) => l.lastContactedAt || !NOT_CONTACTED_STATUSES.includes(l.status));
  const interested = leads.filter((l) => INTERESTED_STATUSES.includes(l.status));
  const converted = leads.filter((l) => l.status === "Converted");
  const followups = leads.filter((l) => l.followUpDate && !CLOSED_STATUSES.includes(l.status));
  const overdue = followups.filter((l) => (l.followUpDate as string) < today);
  const dueToday = followups.filter((l) => l.followUpDate === today);
  const meetings = leads.filter((l) => l.status === "Meeting Scheduled");
  const pipelineValue = leads.filter((l) => !CLOSED_STATUSES.includes(l.status)).reduce((s, l) => s + (l.dealValue || 0), 0);
  const wonValue = converted.reduce((s, l) => s + (l.dealValue || 0), 0);

  const kpis = {
    total: leads.length,
    researched: businesses.filter((b) => b.sources && b.sources !== "[]").length,
    contacted: contacted.length,
    calls: count("CALL"),
    callsConnected: count("CALL", (o) => o.startsWith("Connected")),
    whatsapp: count("WHATSAPP", sentPred),
    emails: count("EMAIL", sentPred),
    interested: interested.length,
    followupsPending: followups.length,
    overdue: overdue.length,
    dueToday: dueToday.length,
    meetings: meetings.length,
    converted: converted.length,
    conversionRate: contacted.length ? converted.length / contacted.length : 0,
    pipelineValue,
    wonValue,
  };

  const byCategory = CATEGORIES.map((c) => ({ label: c, value: leads.filter((l) => l.category === c).length, href: `/leads?category=${encodeURIComponent(c)}` })).sort((a, b) => b.value - a.value);
  const byZone = ZONES.map((z) => ({ label: z, value: leads.filter((l) => l.zone === z).length, href: `/leads?zone=${encodeURIComponent(z)}` }))
    .filter((z) => z.value > 0)
    .sort((a, b) => b.value - a.value);
  const localityCounts = new Map<string, number>();
  leads.forEach((l) => localityCounts.set(l.locality, (localityCounts.get(l.locality) || 0) + 1));
  const topLocalities = [...localityCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));
  const byInterest = ["High", "Medium", "Low"].map((i) => ({ label: i, value: leads.filter((l) => l.interestLevel === i).length }));
  const byStatus = STATUSES.map((s) => ({ label: s, value: leads.filter((l) => l.status === s).length, href: `/leads?status=${encodeURIComponent(s)}` }));

  const days: { day: string; calls: number; whatsapp: number; emails: number; meetings: number }[] = [];
  for (let i = 13; i >= 0; i--) days.push({ day: addDays(today, -i), calls: 0, whatsapp: 0, emails: 0, meetings: 0 });
  for (const a of windowActs) {
    const d = days.find((x) => x.day === isoDate(a.occurredAt));
    if (!d) continue;
    if (a.type === "CALL" || a.type === "VISIT") d.calls++;
    else if (a.type === "WHATSAPP" && sentPred(a.outcome)) d.whatsapp++;
    else if (a.type === "EMAIL" && sentPred(a.outcome)) d.emails++;
    else if (a.type === "MEETING") d.meetings++;
  }

  const funnel = [
    { label: "Researched leads", value: leads.length },
    { label: "Contacted", value: contacted.length },
    { label: "Interested", value: interested.length },
    { label: "Meeting stage", value: leads.filter((l) => ["Meeting Scheduled", "Negotiation", "Converted"].includes(l.status)).length },
    { label: "Converted", value: converted.length },
  ];

  const attention = [...overdue, ...dueToday].slice(0, 8);
  const nextBest = leads.filter((l) => NOT_CONTACTED_STATUSES.includes(l.status) && !l.doNotContact).slice(0, 8);

  return {
    kpis,
    byCategory,
    byZone,
    topLocalities,
    byInterest,
    byStatus,
    days,
    funnel,
    attention,
    nextBest,
    recent: recentActs.map((a) => toActivity(a)),
  };
}
