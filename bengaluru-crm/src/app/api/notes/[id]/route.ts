import { prisma } from "@/lib/db";
import { fail, handle, HttpError, ok, readJSON, str } from "@/lib/api";
import { toNote } from "@/lib/serialize";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = await readJSON<Record<string, unknown>>(req);
  const content = str(body.content, 20000).trim();
  if (!content) throw new HttpError("Note is empty");
  if (!(await prisma.note.findUnique({ where: { id } }))) return fail("Not found", 404);
  return ok(toNote(await prisma.note.update({ where: { id }, data: { content } })));
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!(await prisma.note.findUnique({ where: { id } }))) return fail("Not found", 404);
  await prisma.note.delete({ where: { id } });
  return ok({ deleted: id });
});
