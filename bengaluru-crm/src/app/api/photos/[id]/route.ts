import { prisma } from "@/lib/db";
import { fail, handle, ok } from "@/lib/api";
import { removeUpload } from "@/lib/uploads";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const p = await prisma.photo.findUnique({ where: { id } });
  if (!p) return fail("Not found", 404);
  await prisma.photo.delete({ where: { id } });
  await removeUpload("photos", p.businessId, p.fileName);
  return ok({ deleted: id });
});
