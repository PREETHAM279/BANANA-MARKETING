import { prisma } from "@/lib/db";
import { fail, handle, HttpError, isISODate, ok, readJSON, str } from "@/lib/api";
import { STATUSES, isContactAttempt } from "@/lib/constants";
import { toActivity } from "@/lib/serialize";
import { leadSummary, logStatusChange } from "@/lib/leads";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
const LOGGABLE = ["CALL", "WHATSAPP", "EMAIL", "MEETING", "VISIT", "NOTE", "FOLLOWUP"];

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const rows = await prisma.activity.findMany({ where: { businessId: id }, orderBy: { occurredAt: "desc" } });
  return ok(rows.map((a) => toActivity(a)));
});

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = await readJSON<Record<string, unknown>>(req);
  const lead = await prisma.business.findUnique({ where: { id } });
  if (!lead) return fail("Not found", 404);

  const type = str(body.type, 20).toUpperCase();
  if (!LOGGABLE.includes(type)) throw new HttpError("Unknown activity type");
  const outcome = str(body.outcome, 80);
  const occurredAt = body.occurredAt ? new Date(String(body.occurredAt)) : new Date();
  if (Number.isNaN(occurredAt.getTime())) throw new HttpError("Invalid date");
  const meta: Record<string, unknown> = typeof body.meta === "object" && body.meta ? (body.meta as Record<string, unknown>) : {};
  if (body.durationSec != null) meta.durationSec = Math.max(0, Math.round(Number(body.durationSec) || 0));
  if (body.channelTarget) meta.target = str(body.channelTarget, 200);

  const activity = await prisma.activity.create({
    data: {
      businessId: id,
      type,
      outcome,
      summary: str(body.summary, 300) || [type === "CALL" ? "Call" : type.charAt(0) + type.slice(1).toLowerCase(), outcome].filter(Boolean).join(" - "),
      details: str(body.details, 20000),
      meta: JSON.stringify(meta),
      occurredAt,
    },
  });

  const update: Record<string, unknown> = {};
  if (isContactAttempt(type, outcome)) update.lastContactedAt = occurredAt;
  if (body.setStatus) {
    const s = str(body.setStatus, 40);
    if (!(STATUSES as readonly string[]).includes(s)) throw new HttpError("Unknown status");
    if (s !== lead.status) {
      update.status = s;
      await logStatusChange(id, lead.status, s, `After ${type.toLowerCase()}: ${outcome}`);
    }
  }
  if ("followUpDate" in body) {
    if (body.followUpDate === null || body.followUpDate === "") update.followUpDate = null;
    else if (isISODate(body.followUpDate)) update.followUpDate = body.followUpDate;
  }
  if (typeof body.followUpNote === "string") update.followUpNote = str(body.followUpNote, 500);
  if (typeof body.nextAction === "string") update.nextAction = str(body.nextAction, 500);
  if (typeof body.meetingAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(body.meetingAt)) update.meetingAt = body.meetingAt;
  if (Object.keys(update).length) await prisma.business.update({ where: { id }, data: update });

  if (isISODate(body.outreachDate)) {
    await prisma.outreachTask.upsert({
      where: { date_businessId: { date: body.outreachDate, businessId: id } },
      create: { date: body.outreachDate, businessId: id, done: true, doneAt: new Date() },
      update: { done: true, doneAt: new Date() },
    });
  }

  return ok({ activity: toActivity(activity), lead: await leadSummary(id) });
});
