import { prisma } from "@/lib/db";
import { handle, HttpError, isISODate, ok, readJSON, str } from "@/lib/api";

export const PUT = handle(async (req: Request) => {
  const body = await readJSON<Record<string, unknown>>(req);
  if (!isISODate(body.date)) throw new HttpError("date required");
  const content = str(body.content, 50000);
  const note = await prisma.dayNote.upsert({ where: { date: body.date }, create: { date: body.date, content }, update: { content } });
  return ok({ date: note.date, content: note.content });
});
