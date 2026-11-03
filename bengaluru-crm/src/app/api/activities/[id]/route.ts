import { prisma } from "@/lib/db";
import { fail, handle, ok } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const a = await prisma.activity.findUnique({ where: { id } });
  if (!a) return fail("Not found", 404);
  await prisma.activity.delete({ where: { id } });
  return ok({ deleted: id });
});
