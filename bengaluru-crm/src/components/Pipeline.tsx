"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { GripVertical, PhoneCall, Search } from "lucide-react";
import { CATEGORIES, STATUSES, STATUS_TONE } from "@/lib/constants";
import { cn, dueLabel, inr, telHref } from "@/lib/format";
import { api } from "@/lib/client";
import type { LeadListItem } from "@/lib/types";
import { InterestBadge, StatusBadge } from "./ui/primitives";
import { useToast } from "./ui/toast";

const toneBar: Record<string, string> = {
  neutral: "bg-line-strong",
  accent: "bg-accent",
  violet: "bg-violet",
  warn: "bg-warn",
  good: "bg-good",
  bad: "bg-bad",
};

export function Pipeline({ leads: initial }: { leads: LeadListItem[] }) {
  const toast = useToast();
  const router = useRouter();
  const [leads, setLeads] = useState(initial);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [interest, setInterest] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      leads.filter((l) => {
        if (q && !`${l.name} ${l.locality} ${l.category} ${l.ownerName ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
        if (category && l.category !== category) return false;
        if (interest && l.interestLevel !== interest) return false;
        return true;
      }),
    [leads, q, category, interest],
  );

  const move = async (id: string, status: string) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.status === status) return;
    const prev = lead.status;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    try {
      await api(`/api/businesses/${id}`, { method: "PATCH", body: { status } });
      toast(`${lead.name}: ${prev} → ${status}`);
      router.refresh();
    } catch (e) {
      setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status: prev } : l)));
      toast(e instanceof Error ? e.message : "Could not move", "error");
    }
  };

  const columns = STATUSES.map((s) => ({ status: s, items: visible.filter((l) => l.status === s) })).filter((c) => !hideEmpty || c.items.length);

  return (
    <div>
      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <label className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-8" placeholder="Search the pipeline…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search pipeline" />
        </label>
        <select className="select w-[180px]" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select className="select w-[140px]" value={interest} onChange={(e) => setInterest(e.target.value)} aria-label="Interest">
          <option value="">Any interest</option>
          <option>High</option>
          <option>Medium</option>
          <option>Low</option>
        </select>
        <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
          <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} /> Hide empty stages
        </label>
        <span className="ml-auto text-[12px] text-muted">Drag cards between stages, or use the “Move to” menu on a card.</span>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex min-w-max gap-3">
          {columns.map((col) => {
            const value = col.items.reduce((s, l) => s + (l.dealValue || 0), 0);
            const tone = STATUS_TONE[col.status] ?? "neutral";
            return (
              <section
                key={col.status}
                className={cn("flex w-[268px] shrink-0 flex-col rounded-xl border border-line bg-surface-2/60 transition-colors", over === col.status && "border-accent bg-accent-soft")}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(col.status);
                }}
                onDragLeave={() => setOver((o) => (o === col.status ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || dragId;
                  setOver(null);
                  setDragId(null);
                  if (id) move(id, col.status);
                }}
                aria-label={`${col.status} stage, ${col.items.length} leads`}
              >
                <header className="px-3 pb-2 pt-3">
                  <div className={cn("mb-2 h-[3px] w-8 rounded-full", toneBar[tone])} />
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={col.status} />
                    <span className="tabular text-[12px] text-muted">{col.items.length}</span>
                  </div>
                  {value ? <div className="mt-1 text-[11.5px] text-muted">{inr(value)} potential</div> : null}
                </header>
                <div className="flex max-h-[calc(100vh-260px)] min-h-[120px] flex-col gap-2 overflow-y-auto px-2 pb-2">
                  {col.items.map((l) => {
                    const due = dueLabel(l.followUpDate);
                    return (
                      <article
                        key={l.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", l.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDragId(l.id);
                        }}
                        onDragEnd={() => (setDragId(null), setOver(null))}
                        className={cn("card group cursor-grab p-2.5 active:cursor-grabbing", dragId === l.id && "opacity-50")}
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical size={14} className="mt-0.5 shrink-0 text-line-strong group-hover:text-muted" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <Link href={`/leads/${l.id}`} className="block truncate text-[13px] font-medium hover:text-accent-ink">
                              {l.name}
                            </Link>
                            <p className="truncate text-[11.5px] text-muted">
                              #{l.priorityRank} · {l.category} · {l.locality}
                            </p>
                          </div>
                          {l.phones[0] ? (
                            <a href={telHref(l.phones[0].number)} className="btn btn-ghost btn-sm h-6 px-1 text-muted" title={`Call ${l.phones[0].number}`}>
                              <PhoneCall size={13} />
                            </a>
                          ) : null}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <InterestBadge level={l.interestLevel} />
                          {l.dealValue ? <span className="badge">{inr(l.dealValue)}</span> : null}
                          {due ? <span className={cn("badge", due.tone === "bad" ? "bg-bad-soft text-bad-ink" : due.tone === "warn" ? "bg-warn-soft text-warn-ink" : "")}>{due.text}</span> : null}
                        </div>
                        {l.nextAction ? <p className="mt-1.5 line-clamp-2 text-[11.5px] text-ink-2">→ {l.nextAction}</p> : null}
                        <label className="mt-2 block">
                          <span className="sr-only">Move {l.name} to</span>
                          <select className="select h-7 text-[12px]" value={l.status} onChange={(e) => move(l.id, e.target.value)}>
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s === l.status ? `Stage: ${s}` : `Move to: ${s}`}
                              </option>
                            ))}
                          </select>
                        </label>
                      </article>
                    );
                  })}
                  {col.items.length === 0 ? <p className="px-2 py-6 text-center text-[12px] text-muted">Drop leads here</p> : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
