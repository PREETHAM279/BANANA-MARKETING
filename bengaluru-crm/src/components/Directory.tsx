"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, LayoutGrid, List, MapPin, Phone, RotateCcw, Search, Users } from "lucide-react";
import { CATEGORIES, CLOSED_STATUSES, EMPLOYEE_BANDS, FIT_LEVELS, INTEREST_LEVELS, NOT_CONTACTED_STATUSES, PRODUCTS, PRODUCT_LABEL, STATUSES, ZONES } from "@/lib/constants";
import { cn, dueLabel, telHref } from "@/lib/format";
import { getLocal, setLocal } from "@/lib/client";
import type { LeadListItem } from "@/lib/types";
import { LeadBanner } from "./LeadAvatar";
import { Badge, EmptyState, InterestBadge, StatusBadge } from "./ui/primitives";

const KEYS = ["q", "category", "zone", "locality", "employees", "interest", "social", "attendance", "contact", "status", "product", "sort", "view"] as const;
type Key = (typeof KEYS)[number];
export const DIR_QUERY_KEY = "crm.directoryQuery";

const INTEREST_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

function employeesText(l: LeadListItem) {
  if (l.employeeCountVerified) return l.employeeCountVerified;
  if (l.employeeEstimate) return `~${l.employeeEstimate} (estimate)`;
  return "Not publicly verified";
}

type Filters = Record<Key, string>;
const EMPTY: Filters = Object.fromEntries(KEYS.map((k) => [k, ""])) as Filters;
const fromQS = (qs: string): Filters => {
  const p = new URLSearchParams(qs);
  return Object.fromEntries(KEYS.map((k) => [k, p.get(k) ?? ""])) as Filters;
};
const toQS = (f: Filters) => {
  const p = new URLSearchParams();
  KEYS.forEach((k) => f[k] && p.set(k, f[k]));
  return p.toString();
};

export function Directory({ leads }: { leads: LeadListItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // Filters live in React state (updated atomically, so fast clicks never lose a change)
  // and are mirrored to the URL + localStorage so Back / the sidebar link restore them.
  const [filters, setFilters] = useState<Filters>(() => fromQS(params.toString()));
  const synced = useRef(params.toString());
  const restored = useRef(false);

  // Restore the last filters when you come back to the directory from the sidebar.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (!params.toString()) {
      const saved = getLocal<string>(DIR_QUERY_KEY, "");
      if (saved) setFilters(fromQS(saved));
    }
  }, [params]);

  // URL changed by navigation (Back/Forward, links) -> adopt it.
  useEffect(() => {
    const qs = params.toString();
    if (qs !== synced.current) {
      synced.current = qs;
      setFilters(fromQS(qs));
    }
  }, [params]);

  // Filters changed -> update the URL (debounced for typing) and remember them.
  useEffect(() => {
    const qs = toQS(filters);
    setLocal(DIR_QUERY_KEY, qs);
    if (qs === synced.current) return;
    const t = setTimeout(() => {
      synced.current = qs;
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    }, 200);
    return () => clearTimeout(t);
  }, [filters, pathname, router]);

  const get = (k: Key) => filters[k];
  const set = (k: Key, v: string) => setFilters((f) => ({ ...f, [k]: v, ...(k === "zone" ? { locality: "" } : {}) }));
  const reset = () => setFilters((f) => ({ ...EMPTY, view: f.view }));

  const q = get("q").trim().toLowerCase();
  const view = get("view") === "table" ? "table" : "grid";
  const zone = get("zone");

  const localities = useMemo(() => {
    const set = new Map<string, number>();
    leads.filter((l) => !zone || l.zone === zone).forEach((l) => set.set(l.locality, (set.get(l.locality) || 0) + 1));
    return [...set.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [leads, zone]);

  const filtered = useMemo(() => {
    const f = leads.filter((l) => {
      if (q) {
        const hay = [l.name, l.category, l.subcategory, l.area, l.locality, l.zone, l.ownerName, l.status, l.email, l.website, ...l.tags, ...l.phones.map((p) => p.number)].join(" ").toLowerCase();
        if (!q.split(/\s+/).every((t) => hay.includes(t))) return false;
      }
      if (get("category") && l.category !== get("category")) return false;
      if (zone && l.zone !== zone) return false;
      if (get("locality") && l.locality !== get("locality")) return false;
      if (get("employees") && l.employeeBand !== get("employees")) return false;
      if (get("interest") && l.interestLevel !== get("interest")) return false;
      if (get("social") && l.socialFit !== get("social")) return false;
      if (get("attendance") && l.attendanceFit !== get("attendance")) return false;
      if (get("product") && l.recommendedProduct !== get("product")) return false;
      if (get("status") && l.status !== get("status")) return false;
      const contact = get("contact");
      if (contact === "not-contacted" && !(NOT_CONTACTED_STATUSES.includes(l.status) && !l.lastContactedAt)) return false;
      if (contact === "contacted" && !(l.lastContactedAt || !NOT_CONTACTED_STATUSES.includes(l.status))) return false;
      if (contact === "open" && CLOSED_STATUSES.includes(l.status)) return false;
      if (contact === "has-phone" && !l.phones.length) return false;
      if (contact === "followup" && !l.followUpDate) return false;
      return true;
    });
    const sort = get("sort") || "priority";
    const byName = (a: LeadListItem, b: LeadListItem) => a.name.localeCompare(b.name);
    if (sort === "name") f.sort(byName);
    else if (sort === "interest") f.sort((a, b) => INTEREST_ORDER[a.interestLevel] - INTEREST_ORDER[b.interestLevel] || a.priorityRank - b.priorityRank);
    else if (sort === "recent") f.sort((a, b) => (b.lastContactedAt || "").localeCompare(a.lastContactedAt || "") || a.priorityRank - b.priorityRank);
    else if (sort === "followup") f.sort((a, b) => (a.followUpDate || "9999").localeCompare(b.followUpDate || "9999") || a.priorityRank - b.priorityRank);
    else if (sort === "category") f.sort((a, b) => a.category.localeCompare(b.category) || a.priorityRank - b.priorityRank);
    else f.sort((a, b) => a.priorityRank - b.priorityRank);
    return f;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, filters]);

  const active = KEYS.filter((k) => k !== "view" && k !== "sort" && get(k)).length;

  const sel = (k: Key, label: string, options: (string | [string, string])[], width = "w-[150px]") => (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select className={cn("select", width, get(k) ? "border-accent text-accent-ink" : "")} value={get(k)} onChange={(e) => set(k, e.target.value)} aria-label={label}>
        <option value="">{label}</option>
        {options.map((o) => {
          const [v, t] = Array.isArray(o) ? o : [o, o];
          return (
            <option key={v} value={v}>
              {t}
            </option>
          );
        })}
      </select>
    </label>
  );

  return (
    <div>
      <div className="card mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[220px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input pl-8" placeholder="Search name, area, owner, phone, tag…" value={get("q")} onChange={(e) => set("q", e.target.value)} aria-label="Search businesses" autoComplete="off" />
          </label>
          {sel("category", "All categories", [...CATEGORIES], "w-[170px]")}
          {sel("zone", "All locations", [...ZONES], "w-[150px]")}
          {sel(
            "locality",
            "All localities",
            localities.map(([name, n]) => [name, `${name} (${n})`] as [string, string]),
            "w-[160px]",
          )}
          {sel(
            "employees",
            "Employees (est.)",
            EMPLOYEE_BANDS.filter((b) => b !== "Unknown").map((b) => [b, `${b} employees`] as [string, string]),
            "w-[150px]",
          )}
          {sel("interest", "Interest", INTEREST_LEVELS.map((i) => [i, `${i} potential`] as [string, string]), "w-[135px]")}
          {sel("social", "Social media fit", FIT_LEVELS.map((i) => [i, `Social fit: ${i}`] as [string, string]), "w-[150px]")}
          {sel("attendance", "Attendance fit", FIT_LEVELS.map((i) => [i, `Attendance fit: ${i}`] as [string, string]), "w-[150px]")}
          {sel("product", "Recommended app", PRODUCTS.map((p) => [p, PRODUCT_LABEL[p]] as [string, string]), "w-[160px]")}
          {sel(
            "contact",
            "Contact status",
            [
              ["not-contacted", "Not contacted yet"],
              ["contacted", "Contacted"],
              ["open", "Open (not closed)"],
              ["followup", "Has follow-up date"],
              ["has-phone", "Has public phone"],
            ],
            "w-[160px]",
          )}
          {sel("status", "Pipeline status", [...STATUSES], "w-[160px]")}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[12.5px] text-muted">
            Showing <span className="font-medium text-ink">{filtered.length}</span> of {leads.length} businesses
            {active ? (
              <button className="ml-2 inline-flex items-center gap-1 text-accent-ink hover:underline" onClick={reset}>
                <RotateCcw size={12} /> Clear {active} filter{active > 1 ? "s" : ""}
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <select className="select w-[170px]" value={get("sort") || "priority"} onChange={(e) => set("sort", e.target.value === "priority" ? "" : e.target.value)} aria-label="Sort">
              <option value="priority">Sort: Priority rank</option>
              <option value="interest">Sort: Interest level</option>
              <option value="name">Sort: Name A–Z</option>
              <option value="category">Sort: Category</option>
              <option value="followup">Sort: Follow-up date</option>
              <option value="recent">Sort: Last contacted</option>
            </select>
            <div className="flex rounded-lg border border-line-strong p-0.5">
              <button className={cn("btn btn-sm btn-ghost h-7 px-2", view === "grid" && "bg-surface-3")} onClick={() => set("view", "")} aria-pressed={view === "grid"} title="Cards">
                <LayoutGrid size={14} />
              </button>
              <button className={cn("btn btn-sm btn-ghost h-7 px-2", view === "table" && "bg-surface-3")} onClick={() => set("view", "table")} aria-pressed={view === "table"} title="Table">
                <List size={14} />
              </button>
            </div>
            <a className="btn btn-sm" href="/api/export?format=csv" title="Download all leads as CSV">
              <Download size={14} /> CSV
            </a>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Search size={22} />} title="No businesses match these filters">
            <button className="link" onClick={reset}>
              Clear filters
            </button>
          </EmptyState>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((l) => (
            <LeadCard key={l.id} lead={l} />
          ))}
        </div>
      ) : (
        <LeadTable leads={filtered} />
      )}
    </div>
  );
}

function LeadCard({ lead: l }: { lead: LeadListItem }) {
  const phone = l.phones[0];
  const due = dueLabel(l.followUpDate);
  return (
    <article className="card group relative flex flex-col overflow-hidden transition-colors hover:border-line-strong">
      <Link href={`/leads/${l.id}`} className="absolute inset-0 z-0" aria-label={`Open ${l.name}`} />
      <div className="relative">
        <LeadBanner name={l.name} category={l.category} photoUrl={l.photoUrl} height={92} />
        <span className="badge absolute left-2 top-2 border-transparent bg-surface/90 font-semibold text-ink backdrop-blur" title="Priority rank (1 = call first)">
          #{l.priorityRank}
        </span>
        {l.doNotContact ? <Badge tone="bad" className="absolute right-2 top-2">Do not contact</Badge> : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div>
          <h3 className="truncate text-[14px] font-semibold leading-snug group-hover:text-accent-ink">{l.name}</h3>
          <p className="truncate text-[12px] text-muted">
            {l.category} · {l.subcategory}
          </p>
        </div>
        <div className="space-y-1 text-[12.5px] text-ink-2">
          <p className="flex items-center gap-1.5 truncate">
            <MapPin size={13} className="shrink-0 text-muted" />
            {l.locality} · {l.zone}
          </p>
          <p className="flex items-center gap-1.5 truncate" title={l.employeeCountVerified ? "Verified from a public source" : "Estimate - not verified"}>
            <Users size={13} className="shrink-0 text-muted" />
            {employeesText(l)}
          </p>
          <p className="relative z-10 flex items-center gap-1.5 truncate">
            <Phone size={13} className="shrink-0 text-muted" />
            {phone ? (
              <a href={telHref(phone.number)} className="link tabular" title={`${phone.label} - click to call`}>
                {phone.number}
              </a>
            ) : (
              <span className="italic text-muted">Not publicly verified</span>
            )}
          </p>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <InterestBadge level={l.interestLevel} />
          <Badge tone="accent">{PRODUCT_LABEL[l.recommendedProduct]}</Badge>
          <StatusBadge status={l.status} />
          {due ? <Badge tone={due.tone === "neutral" ? "neutral" : due.tone}>{due.text}</Badge> : null}
        </div>
      </div>
    </article>
  );
}

function LeadTable({ leads }: { leads: LeadListItem[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[980px] text-[12.5px]">
        <thead>
          <tr className="border-b border-line text-left text-[11.5px] uppercase tracking-wide text-muted">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Business</th>
            <th className="px-3 py-2 font-medium">Location</th>
            <th className="px-3 py-2 font-medium">Employees</th>
            <th className="px-3 py-2 font-medium">Phone</th>
            <th className="px-3 py-2 font-medium">Interest</th>
            <th className="px-3 py-2 font-medium">Recommended</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Follow-up</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => {
            const due = dueLabel(l.followUpDate);
            return (
              <tr key={l.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                <td className="tabular px-3 py-2 text-muted">{l.priorityRank}</td>
                <td className="px-3 py-2">
                  <Link href={`/leads/${l.id}`} className="font-medium hover:text-accent-ink">
                    {l.name}
                  </Link>
                  <div className="text-[11.5px] text-muted">{l.category}</div>
                </td>
                <td className="px-3 py-2">
                  {l.locality}
                  <div className="text-[11.5px] text-muted">{l.zone}</div>
                </td>
                <td className="px-3 py-2">{l.employeeCountVerified ? l.employeeCountVerified : <span className="text-muted">~{l.employeeEstimate || "?"} est.</span>}</td>
                <td className="tabular px-3 py-2">
                  {l.phones[0] ? (
                    <a href={telHref(l.phones[0].number)} className="link">
                      {l.phones[0].number}
                    </a>
                  ) : (
                    <span className="italic text-muted">Not verified</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <InterestBadge level={l.interestLevel} />
                </td>
                <td className="px-3 py-2">{PRODUCT_LABEL[l.recommendedProduct]}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={l.status} />
                </td>
                <td className="px-3 py-2">{due ? <span className={due.tone === "bad" ? "text-bad-ink" : due.tone === "warn" ? "text-warn-ink" : ""}>{due.text}</span> : <span className="text-muted">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
