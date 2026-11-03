import { prisma } from "@/lib/db";
import { fail, handle, HttpError, isISODate, ok, readJSON, str } from "@/lib/api";
import { STATUSES } from "@/lib/constants";
import { getLeadDetail } from "@/lib/queries";
import { leadSummary, logStatusChange } from "@/lib/leads";
import { formatDay } from "@/lib/format";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const lead = await getLeadDetail(id);
  return lead ? ok(lead) : fail("Not found", 404);
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = await readJSON<Record<string, unknown>>(req);
  const current = await prisma.business.findUnique({ where: { id } });
  if (!current) return fail("Not found", 404);

  const data: Record<string, unknown> = {};
  if ("status" in body) {
    const s = str(body.status, 40);
    if (!(STATUSES as readonly string[]).includes(s)) throw new HttpError("Unknown status");
    data.status = s;
  }
  if ("followUpDate" in body) {
    if (body.followUpDate === null || body.followUpDate === "") data.followUpDate = null;
    else if (isISODate(body.followUpDate)) data.followUpDate = body.followUpDate;
    else throw new HttpError("followUpDate must be YYYY-MM-DD");
  }
  if ("followUpNote" in body) data.followUpNote = str(body.followUpNote, 500);
  if ("nextAction" in body) data.nextAction = str(body.nextAction, 500);
  if ("dealValue" in body) {
    if (body.dealValue === null || body.dealValue === "") data.dealValue = null;
    else {
      const n = Math.round(Number(body.dealValue));
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) throw new HttpError("Deal value must be a positive number");
      data.dealValue = n;
    }
  }
  if ("tags" in body) {
    if (!Array.isArray(body.tags)) throw new HttpError("tags must be a list");
    const tags = [...new Set(body.tags.map((t) => str(t, 40).trim()).filter(Boolean))].slice(0, 20);
    data.tags = JSON.stringify(tags);
  }
  if ("meetingAt" in body) {
    if (body.meetingAt === null || body.meetingAt === "") data.meetingAt = null;
    else if (typeof body.meetingAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(body.meetingAt)) data.meetingAt = body.meetingAt;
    else throw new HttpError("meetingAt must be YYYY-MM-DDTHH:MM");
  }
  if ("doNotContact" in body) data.doNotContact = Boolean(body.doNotContact);
  if (!Object.keys(data).length) throw new HttpError("Nothing to update");

  await prisma.business.update({ where: { id }, data });

  if (data.status && data.status !== current.status) await logStatusChange(id, current.status, String(data.status));
  if ("followUpDate" in data && data.followUpDate !== current.followUpDate && data.followUpDate) {
    await prisma.activity.create({
      data: { businessId: id, type: "FOLLOWUP", outcome: "Scheduled", summary: `Follow-up set for ${formatDay(String(data.followUpDate))}`, details: str(body.followUpNote ?? current.followUpNote, 500) },
    });
  }
  if ("meetingAt" in data && data.meetingAt && data.meetingAt !== current.meetingAt) {
    await prisma.activity.create({
      data: { businessId: id, type: "MEETING", outcome: "Scheduled", summary: `Meeting scheduled for ${String(data.meetingAt).replace("T", " ")}` },
    });
  }
  if ("doNotContact" in data && data.doNotContact !== current.doNotContact) {
    await prisma.activity.create({
      data: { businessId: id, type: "NOTE", outcome: data.doNotContact ? "Do not contact" : "Contact allowed", summary: data.doNotContact ? "Marked as do-not-contact" : "Do-not-contact removed" },
    });
  }
  return ok(await leadSummary(id));
});
