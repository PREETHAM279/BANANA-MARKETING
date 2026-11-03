import { prisma } from "@/lib/db";
import { fail, handle, HttpError, ok, readJSON, str } from "@/lib/api";
import { toNote } from "@/lib/serialize";

type Ctx = { params: Promise<{ id: string }> };
const KINDS = ["General", "Call", "Meeting", "Research"];

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = await readJSON<Record<string, unknown>>(req);
  if (!(await prisma.business.findUnique({ where: { id }, select: { id: true } }))) return fail("Not found", 404);
  const content = str(body.content, 20000).trim();
  if (!content) throw new HttpError("Note is empty");
  const kind = KINDS.includes(String(body.kind)) ? String(body.kind) : "General";
  const note = await prisma.note.create({ data: { businessId: id, kind, content } });
  return ok(toNote(note));
});
