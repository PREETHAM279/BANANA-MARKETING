import { prisma } from "@/lib/db";
import { handle, ok, readJSON, str } from "@/lib/api";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { getSettings, integrationStatus } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const GET = handle(async () => ok({ settings: await getSettings(), integrations: integrationStatus() }));

export const PUT = handle(async (req: Request) => {
  const body = await readJSON<Record<string, unknown>>(req);
  for (const [key, value] of Object.entries(body)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    const v = str(value, 2000);
    await prisma.setting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
  }
  return ok({ settings: await getSettings() });
});
