import { prisma } from "@/lib/db";
import { fail, handle, HttpError, ok, str } from "@/lib/api";
import { toRecording } from "@/lib/serialize";
import { AUDIO_TYPES, saveUpload } from "@/lib/uploads";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!(await prisma.business.findUnique({ where: { id }, select: { id: true } }))) return fail("Not found", 404);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError("No audio uploaded");
  const { fileName, mimeType } = await saveUpload("recordings", id, file, AUDIO_TYPES, 60_000_000);
  const durationSec = Math.max(0, Math.round(Number(form?.get("durationSec")) || 0));
  const note = str(form?.get("note"), 2000);
  const rec = await prisma.recording.create({ data: { businessId: id, fileName, mimeType, durationSec, note } });
  await prisma.activity.create({
    data: {
      businessId: id,
      type: "NOTE",
      outcome: "Voice note",
      summary: `Voice note recorded (${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, "0")})`,
      details: note,
      meta: JSON.stringify({ recordingId: rec.id }),
    },
  });
  return ok(toRecording(rec));
});
