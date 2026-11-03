import { prisma } from "@/lib/db";
import { fail, handle, ok } from "@/lib/api";
import { googleLookup } from "@/lib/enrich";
import { getLeadDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await prisma.business.findUnique({ where: { id } });
  if (!b) return fail("Not found", 404);
  if (!process.env.GOOGLE_PLACES_API_KEY) return fail("Add GOOGLE_PLACES_API_KEY to .env.local and restart the CRM to use Google data.", 400);
  const g = await googleLookup(b.mapsQuery || `${b.name}, ${b.area}, Bengaluru`);
  if (!g) return fail("Google did not return a matching place", 404);
  await prisma.business.update({
    where: { id },
    data: {
      googleData: JSON.stringify(g),
      googlePlaceId: g.placeId,
      googleRating: g.rating ?? null,
      googleReviews: g.userRatingCount ?? null,
      googleMapsUri: g.mapsUri ?? null,
      googleFetchedAt: new Date(),
    },
  });
  await prisma.activity.create({
    data: {
      businessId: id,
      type: "ENRICH",
      outcome: "Google data",
      summary: `Google Places: ${g.name ?? "match"} - ${g.rating ?? "no"} rating, ${g.userRatingCount ?? 0} reviews`,
      details: g.address ?? "",
    },
  });
  return ok(await getLeadDetail(id));
});
