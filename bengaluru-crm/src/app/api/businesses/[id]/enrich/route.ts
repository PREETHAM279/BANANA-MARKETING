import { prisma } from "@/lib/db";
import { fail, handle, ok } from "@/lib/api";
import { scrapeWebsite } from "@/lib/enrich";
import { getLeadDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await prisma.business.findUnique({ where: { id } });
  if (!b) return fail("Not found", 404);
  if (!b.website) return fail("No official website on file for this business", 400);
  try {
    const site = await scrapeWebsite(b.website);
    await prisma.business.update({
      where: { id },
      data: {
        siteData: JSON.stringify(site),
        siteFetchedAt: new Date(),
        ...(site.image ? { photoUrl: site.image, photoSource: `Image published on the official website (${new URL(site.finalUrl || site.url).hostname})` } : {}),
      },
    });
    await prisma.activity.create({
      data: {
        businessId: id,
        type: "ENRICH",
        outcome: "Website checked",
        summary: `Official website checked: ${site.emails.length} email(s), ${site.phones.length} phone(s), ${Object.keys(site.socials).length} social link(s)`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not fetch website";
    await prisma.business.update({ where: { id }, data: { siteFetchedAt: new Date(), siteData: JSON.stringify({ url: b.website, emails: [], phones: [], socials: {}, fetchedAt: new Date().toISOString(), error: msg }) } });
    return fail(`Could not read ${b.website}: ${msg}`, 502);
  }
  return ok(await getLeadDetail(id));
});
