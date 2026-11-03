import "server-only";
import { prisma } from "./db";
import { toActivity, toDetail, toListItem } from "./serialize";
import { DEFAULT_SETTINGS } from "./constants";

export async function getLeadList() {
  const rows = await prisma.business.findMany({
    orderBy: { priorityRank: "asc" },
    include: { photos: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  return rows.map(toListItem);
}

export async function getLeadDetail(id: string) {
  const b = await prisma.business.findUnique({
    where: { id },
    include: {
      activities: { orderBy: { occurredAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" } },
      photos: { orderBy: { createdAt: "asc" } },
      recordings: { orderBy: { createdAt: "desc" } },
    },
  });
  return b ? toDetail(b) : null;
}

export async function getRecentActivities(limit = 30, types?: string[]) {
  const rows = await prisma.activity.findMany({
    where: types ? { type: { in: types } } : { type: { notIn: ["SYSTEM"] } },
    orderBy: { occurredAt: "desc" },
    take: limit,
    include: { business: { select: { name: true } } },
  });
  return rows.map((a) => toActivity(a));
}

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  const values: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) values[r.key] = r.value;
  return values;
}

export function integrationStatus() {
  return {
    googlePlaces: Boolean(process.env.GOOGLE_PLACES_API_KEY),
    smtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER || "",
  };
}
