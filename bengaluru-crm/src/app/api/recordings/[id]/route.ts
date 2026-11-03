import { prisma } from "@/lib/db";
import { fail, handle, ok } from "@/lib/api";
import { removeUpload } from "@/lib/uploads";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const r = await prisma.recording.findUnique({ where: { id } });
  if (!r) return fail("Not found", 404);
  await prisma.recording.delete({ where: { id } });
  await removeUpload("recordings", r.businessId, r.fileName);
  return ok({ deleted: id });
});
