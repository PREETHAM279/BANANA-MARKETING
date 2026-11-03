import { prisma } from "@/lib/db";
import { handle, HttpError, isISODate, ok, readJSON, str } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const date = new URL(req.url).searchParams.get("date");
  if (!isISODate(date)) throw new HttpError("date=YYYY-MM-DD required");
  const [tasks, dayNote] = await Promise.all([prisma.outreachTask.findMany({ where: { date } }), prisma.dayNote.findUnique({ where: { date } })]);
  return ok({ tasks, dayNote: dayNote?.content ?? "" });
});

export const POST = handle(async (req: Request) => {
  const body = await readJSON<Record<string, unknown>>(req);
  if (!isISODate(body.date)) throw new HttpError("date required");
  const businessId = str(body.businessId, 120);
  if (!(await prisma.business.findUnique({ where: { id: businessId }, select: { id: true } }))) throw new HttpError("Unknown business", 404);
  const data: { done?: boolean; doneAt?: Date | null; note?: string; skipped?: boolean } = {};
  if ("done" in body) {
    data.done = Boolean(body.done);
    data.doneAt = data.done ? new Date() : null;
  }
  if ("note" in body) data.note = str(body.note, 5000);
  if ("skipped" in body) data.skipped = Boolean(body.skipped);
  const task = await prisma.outreachTask.upsert({
    where: { date_businessId: { date: body.date, businessId } },
    create: { date: body.date, businessId, ...data },
    update: data,
  });
  return ok(task);
});
