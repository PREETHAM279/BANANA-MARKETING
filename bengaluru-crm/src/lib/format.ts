import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function phoneDigits(number: string): string {
  const d = String(number || "").replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
  return d;
}

export function telHref(number: string): string {
  return `tel:+${phoneDigits(number)}`;
}

export function waHref(number: string, text?: string): string {
  const base = `https://wa.me/${phoneDigits(number)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function mailtoHref(to: string, subject: string, body: string): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  // URLSearchParams encodes spaces as "+", which some mail apps keep literally.
  return `mailto:${encodeURIComponent(to || "")}?${params.toString().replace(/\+/g, "%20")}`;
}

export function gmailComposeHref(to: string, subject: string, body: string): string {
  const params = new URLSearchParams({ view: "cm", fs: "1", to: to || "", su: subject || "", body: body || "" });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function mapsEmbedUrl(query: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

/** Local calendar date (YYYY-MM-DD) - the app runs on your Mac, so local time is IST. */
export function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return isoDate(dt);
}

export function todayISO() {
  return isoDate();
}

export function tomorrowISO() {
  return addDays(isoDate(), 1);
}

export function formatDay(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function formatDayLong(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "";
  const dt = typeof value === "string" ? new Date(value) : value;
  return dt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function relativeTime(value?: string | Date | null): string {
  if (!value) return "";
  const dt = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - dt.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const days = Math.round(hr / 24);
  if (days < 7) return `${days} d ago`;
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function dueLabel(iso?: string | null): { text: string; tone: "bad" | "warn" | "accent" | "neutral" } | null {
  if (!iso) return null;
  const today = todayISO();
  if (iso < today) return { text: `Overdue · ${formatDay(iso)}`, tone: "bad" };
  if (iso === today) return { text: "Due today", tone: "warn" };
  if (iso === addDays(today, 1)) return { text: "Due tomorrow", tone: "accent" };
  return { text: formatDay(iso), tone: "neutral" };
}

export function inr(value?: number | null): string {
  if (value == null) return "";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export function compact(n: number): string {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1).replace(/\.0$/, "")} Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1).replace(/\.0$/, "")} L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function hostOf(url?: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function fillPlaceholders(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] || `[${key === "yourName" ? "your name" : key === "yourCompany" ? "your company" : key}]`);
}
