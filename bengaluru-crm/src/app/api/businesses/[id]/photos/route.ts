import { prisma } from "@/lib/db";
import { fail, handle, HttpError, ok, str } from "@/lib/api";
import { toPhoto } from "@/lib/serialize";
import { IMAGE_TYPES, saveUpload } from "@/lib/uploads";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!(await prisma.business.findUnique({ where: { id }, select: { id: true } }))) return fail("Not found", 404);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError("No file uploaded");
  const { fileName } = await saveUpload("photos", id, file, IMAGE_TYPES, 15_000_000);
  const photo = await prisma.photo.create({
    data: { businessId: id, fileName, caption: str(form?.get("caption"), 200), source: str(form?.get("source"), 200) || "Uploaded by you" },
  });
  return ok(toPhoto(photo));
});
