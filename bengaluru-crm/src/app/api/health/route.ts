import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const count = await prisma.business.count();
    return Response.json({ ok: true, businesses: count, time: new Date().toISOString() });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "db error" }, { status: 500 });
  }
}
