import "server-only";
import { prisma } from "./db";
import { toListItem } from "./serialize";

export async function leadSummary(id: string) {
  const b = await prisma.business.findUnique({ where: { id }, include: { photos: { orderBy: { createdAt: "asc" }, take: 1 } } });
  return b ? toListItem(b) : null;
}

export async function logStatusChange(businessId: string, from: string, to: string, reason = "") {
  await prisma.activity.create({
    data: { businessId, type: "STATUS", outcome: to, summary: `Status: ${from} → ${to}`, details: reason },
  });
}
