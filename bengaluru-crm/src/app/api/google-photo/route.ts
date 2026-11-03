export const dynamic = "force-dynamic";

const NAME = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("name") || "";
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || !NAME.test(name)) return new Response("Not available", { status: 404 });
  const res = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=900&key=${encodeURIComponent(key)}`, { redirect: "follow" });
  if (!res.ok) return new Response("Photo unavailable", { status: 502 });
  return new Response(await res.arrayBuffer(), {
    headers: { "Content-Type": res.headers.get("content-type") || "image/jpeg", "Cache-Control": "private, max-age=86400" },
  });
}
