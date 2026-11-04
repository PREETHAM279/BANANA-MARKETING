import "server-only";
import type { GoogleData, SiteData } from "./types";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|169\.254\.|0\.|\[?::1\]?|\[?fc|\[?fd)/i;

async function fetchText(url: string, timeoutMs = 12000): Promise<{ html: string; finalUrl: string }> {
  const u = new URL(url);
  // CRM_ALLOW_PRIVATE_FETCH=1 exists only for the automated tests (they serve sample pages on localhost).
  const allowPrivate = process.env.CRM_ALLOW_PRIVATE_FETCH === "1";
  if (!/^https?:$/.test(u.protocol) || (!allowPrivate && PRIVATE_HOST.test(u.hostname))) throw new Error("Only public http(s) websites can be fetched");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(u, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" }, redirect: "follow", signal: ctrl.signal });
    if (!res.ok) throw new Error(`Website answered ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) return { html: await res.text(), finalUrl: res.url };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < 1_500_000) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    await reader.cancel().catch(() => {});
    return { html: Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8"), finalUrl: res.url };
  } finally {
    clearTimeout(t);
  }
}

function decode(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function meta(html: string, name: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, "i");
  const tag = re.exec(html)?.[0];
  if (!tag) return undefined;
  const c = /content=["']([^"']*)["']/i.exec(tag)?.[1];
  return c ? decode(c) : undefined;
}

function extract(html: string, baseUrl: string) {
  const emails = new Set<string>();
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) emails.add(decodeURIComponent(m[1]).toLowerCase());
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) {
    const e = m[0].toLowerCase();
    if (!/\.(png|jpe?g|gif|webp|svg|css|js)$/.test(e) && !e.includes("sentry") && !e.includes("example.")) emails.add(e);
  }
  const phones = new Set<string>();
  for (const m of html.matchAll(/tel:([+\d\s()-]{8,20})/gi)) phones.add(m[1].replace(/[^\d+]/g, ""));
  const plain = text.replace(/<[^>]+>/g, " ");
  for (const m of plain.matchAll(/(?:\+91[\s-]?)?(?:0?80[\s-]?\d{4}[\s-]?\d{4}|[6-9]\d{4}[\s-]?\d{5})/g)) {
    const d = m[0].replace(/[^\d+]/g, "");
    if (d.replace(/\D/g, "").length >= 10) phones.add(d);
  }
  const socials: Record<string, string> = {};
  const patterns: [string, RegExp][] = [
    ["instagram", /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]+\/?/i],
    ["facebook", /https?:\/\/(?:www\.|m\.)?facebook\.com\/[A-Za-z0-9_.\-/]+/i],
    ["linkedin", /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9_\-]+\/?/i],
    ["youtube", /https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/|user\/)[A-Za-z0-9_\-]+/i],
    ["twitter", /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+/i],
  ];
  for (const [k, re] of patterns) {
    const m = re.exec(html);
    if (m && !/\/(sharer|share|intent|plugins|dialog)/i.test(m[0])) socials[k] = m[0];
  }
  let image = meta(html, "og:image") || meta(html, "twitter:image");
  if (image) {
    try {
      image = new URL(image, baseUrl).toString();
    } catch {
      image = undefined;
    }
  }
  const title = meta(html, "og:title") || decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] || "");
  const description = meta(html, "og:description") || meta(html, "description");
  let contactUrl: string | undefined;
  for (const m of html.matchAll(/href=["']([^"'#]+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)) {
    if (/contact/i.test(m[1]) || /contact/i.test(m[2])) {
      try {
        const u = new URL(m[1], baseUrl);
        if (u.hostname === new URL(baseUrl).hostname) {
          contactUrl = u.toString();
          break;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return { emails, phones, socials, image: image || null, title, description, contactUrl };
}

export async function scrapeWebsite(url: string): Promise<SiteData> {
  const { html, finalUrl } = await fetchText(url);
  const first = extract(html, finalUrl);
  if (first.contactUrl && first.contactUrl !== finalUrl) {
    try {
      const contact = await fetchText(first.contactUrl, 8000);
      const second = extract(contact.html, contact.finalUrl);
      second.emails.forEach((e) => first.emails.add(e));
      second.phones.forEach((p) => first.phones.add(p));
      for (const [k, v] of Object.entries(second.socials)) first.socials[k] ??= v;
    } catch {
      /* contact page optional */
    }
  }
  return {
    url,
    finalUrl,
    title: first.title || undefined,
    description: first.description,
    image: first.image,
    emails: [...first.emails].slice(0, 10),
    phones: [...first.phones].slice(0, 10),
    socials: first.socials,
    fetchedAt: new Date().toISOString(),
  };
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.businessStatus",
  "places.photos",
].join(",");

export async function googleLookup(query: string): Promise<GoogleData | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not set in .env.local");
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELD_MASK },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 1,
      regionCode: "IN",
      locationBias: { circle: { center: { latitude: 12.9716, longitude: 77.5946 }, radius: 50000 } },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (json.error as { message?: string } | undefined)?.message || `Google Places error ${res.status}`;
    throw new Error(msg);
  }
  const place = (json.places as Record<string, unknown>[] | undefined)?.[0];
  if (!place) return null;
  type Photo = { name: string; authorAttributions?: { displayName?: string; uri?: string }[] };
  return {
    placeId: String(place.id),
    name: (place.displayName as { text?: string } | undefined)?.text,
    address: place.formattedAddress as string | undefined,
    rating: (place.rating as number | undefined) ?? null,
    userRatingCount: (place.userRatingCount as number | undefined) ?? null,
    mapsUri: (place.googleMapsUri as string | undefined) ?? null,
    phone: (place.nationalPhoneNumber as string | undefined) ?? null,
    website: (place.websiteUri as string | undefined) ?? null,
    businessStatus: (place.businessStatus as string | undefined) ?? null,
    photos: ((place.photos as Photo[] | undefined) ?? []).slice(0, 6).map((p) => ({ name: p.name, attributions: p.authorAttributions ?? [] })),
    fetchedAt: new Date().toISOString(),
  };
}
