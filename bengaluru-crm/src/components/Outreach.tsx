"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, ChevronRight, Mail, PhoneCall, Play, Printer, Search, SkipForward, X, Zap } from "lucide-react";
import { CALL_BLOCKS, CATEGORIES, CLOSED_STATUSES, PRODUCT_LABEL } from "@/lib/constants";
import { addDays, cn, dueLabel, formatDayLong, telHref, todayISO } from "@/lib/format";
import { api } from "@/lib/client";
import { personalize } from "@/lib/templates";
import type { LeadListItem } from "@/lib/types";
import { CopyButton, EmailDialog, LogActivityDialog, WhatsAppDialog, type LoggedResult, type Settings } from "./comms";
import { Badge, InterestBadge, StatusBadge } from "./ui/primitives";
import { WhatsappIcon } from "./ui/icons";
import { useToast } from "./ui/toast";

type Task = { businessId: string; done: boolean; note: string; skipped: boolean; doneAt: string | null };
type Dialog = null | { kind: "log"; lead: LeadListItem; startedAt?: number; number?: string } | { kind: "wa"; lead: LeadListItem; number?: string } | { kind: "email"; lead: LeadListItem };

const blank = (id: string): Task => ({ businessId: id, done: false, note: "", skipped: false, doneAt: null });

const QUICK_OUTCOMES: { label: string; outcome: string; status?: string; followDays?: number; tone?: string }[] = [
  { label: "No answer", outcome: "No answer", followDays: 1 },
  { label: "Busy / call back", outcome: "Connected - call back later", status: "Follow-up Required", followDays: 2 },
  { label: "Interested", outcome: "Connected - interested", status: "Interested", followDays: 2, tone: "good" },
  { label: "Meeting booked", outcome: "Connected - meeting booked", status: "Meeting Scheduled", tone: "good" },
  { label: "Not interested", outcome: "Connected - not interested", status: "Not Interested", tone: "bad" },
];

export function Outreach({ leads: initial, date, tasks: initialTasks, dayNote: initialNote, settings, smtp }: { leads: LeadListItem[]; date: string; tasks: Task[]; dayNote: string; settings: Settings; smtp: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [leads, setLeads] = useState(initial);
  const [tasks, setTasks] = useState<Record<string, Task>>(() => Object.fromEntries(initialTasks.map((t) => [t.businessId, t])));
  const [order, setOrder] = useState<"plan" | "priority">("plan");
  const [show, setShow] = useState<"all" | "remaining" | "done">("all");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [hideClosed, setHideClosed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState<Dialog>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [dayNote, setDayNote] = useState(initialNote);
  const [noteState, setNoteState] = useState<"" | "saving" | "saved">("");
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => setLeads(initial), [initial]);
  useEffect(() => setTasks(Object.fromEntries(initialTasks.map((t) => [t.businessId, t]))), [initialTasks]);
  useEffect(() => setDayNote(initialNote), [initialNote]);

  const ordered = useMemo(() => {
    const list = [...leads];
    if (order === "priority") list.sort((a, b) => a.priorityRank - b.priorityRank);
    else list.sort((a, b) => a.callBlock - b.callBlock || b.priorityScore - a.priorityScore || a.priorityRank - b.priorityRank);
    return list.map((l, i) => ({ lead: l, n: i + 1 }));
  }, [leads, order]);

  const visible = ordered.filter(({ lead: l }) => {
    const done = tasks[l.id]?.done;
    if (show === "remaining" && done) return false;
    if (show === "done" && !done) return false;
    if (category && l.category !== category) return false;
    if (hideClosed && (CLOSED_STATUSES.includes(l.status) || l.doNotContact)) return false;
    if (q && !`${l.name} ${l.locality} ${l.category} ${l.ownerName ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const doneCount = leads.filter((l) => tasks[l.id]?.done).length;
  const dueOnDate = leads.filter((l) => l.followUpDate && l.followUpDate <= date && !CLOSED_STATUSES.includes(l.status));
  const target = Number(settings.dailyCallTarget) || 40;

  const saveTask = useCallback(
    async (businessId: string, data: Partial<Task>) => {
      setTasks((t) => ({ ...t, [businessId]: { ...(t[businessId] ?? blank(businessId)), ...data } }));
      try {
        await api(`/api/outreach`, { body: { date, businessId, ...data } });
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not save", "error");
      }
    },
    [date, toast],
  );

  const onRowNote = (id: string, note: string) => {
    setTasks((t) => ({ ...t, [id]: { ...(t[id] ?? blank(id)), note } }));
    clearTimeout(rowTimers.current[id]);
    rowTimers.current[id] = setTimeout(() => api(`/api/outreach`, { body: { date, businessId: id, note } }).catch(() => toast("Could not save note", "error")), 600);
  };

  const onDayNote = (v: string) => {
    setDayNote(v);
    setNoteState("saving");
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(async () => {
      await api(`/api/outreach/daynote`, { method: "PUT", body: { date, content: v } }).catch(() => toast("Could not save notes", "error"));
      setNoteState("saved");
    }, 700);
  };

  const setFollowUp = async (l: LeadListItem, value: string) => {
    setLeads((ls) => ls.map((x) => (x.id === l.id ? { ...x, followUpDate: value || null } : x)));
    try {
      await api(`/api/businesses/${l.id}`, { method: "PATCH", body: { followUpDate: value || null } });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    }
  };

  const onLogged = (r: LoggedResult) => {
    setLeads((ls) => ls.map((x) => (x.id === r.lead.id ? r.lead : x)));
    setTasks((t) => ({ ...t, [r.lead.id]: { ...(t[r.lead.id] ?? blank(r.lead.id)), done: true, doneAt: new Date().toISOString() } }));
    router.refresh();
  };

  const quickLog = async (l: LeadListItem, o: (typeof QUICK_OUTCOMES)[number]) => {
    try {
      const body: Record<string, unknown> = { type: "CALL", outcome: o.outcome, outreachDate: date, details: tasks[l.id]?.note || "" };
      if (o.status && o.status !== l.status) body.setStatus = o.status;
      else if (["Researched", "New Lead", "Not Contacted"].includes(l.status)) body.setStatus = "Called";
      if (o.followDays) body.followUpDate = addDays(todayISO(), o.followDays);
      const r = await api<LoggedResult>(`/api/businesses/${l.id}/activities`, { body });
      onLogged(r);
      toast(`${l.name}: ${o.label}`);
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not log", "error");
      return false;
    }
  };

  const goDate = (d: string) => router.push(`/outreach?date=${d}`);

  // ----- Call mode -----
  const queue = visible.filter(({ lead: l }) => !l.doNotContact);
  const current = focus != null ? queue[focus] : null;
  useEffect(() => {
    if (focus == null) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (dialog) return;
      if (e.key === "Escape") setFocus(null);
      if (e.key === "ArrowRight" || e.key === "j") setFocus((f) => (f == null ? f : Math.min(queue.length - 1, f + 1)));
      if (e.key === "ArrowLeft" || e.key === "k") setFocus((f) => (f == null ? f : Math.max(0, f - 1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, queue.length, dialog]);

  const startCallMode = () => {
    const first = queue.findIndex(({ lead }) => !tasks[lead.id]?.done);
    setFocus(first >= 0 ? first : 0);
  };

  let lastBlock = -1;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3">
        <div className="card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <button className="btn btn-sm px-2" onClick={() => goDate(addDays(date, -1))} aria-label="Previous day">
                <ArrowLeft size={14} />
              </button>
              <label className="relative">
                <CalendarDays size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input type="date" className="input h-8 w-[160px] pl-8" value={date} onChange={(e) => e.target.value && goDate(e.target.value)} aria-label="Outreach date" />
              </label>
              <button className="btn btn-sm px-2" onClick={() => goDate(addDays(date, 1))} aria-label="Next day">
                <ArrowRight size={14} />
              </button>
              {date !== addDays(todayISO(), 1) ? (
                <button className="btn btn-sm btn-ghost text-accent-ink" onClick={() => goDate(addDays(todayISO(), 1))}>
                  Tomorrow
                </button>
              ) : null}
              {date !== todayISO() ? (
                <button className="btn btn-sm btn-ghost text-accent-ink" onClick={() => goDate(todayISO())}>
                  Today
                </button>
              ) : null}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button className="btn btn-sm no-print" onClick={() => window.print()} title="Print or save as PDF">
                <Printer size={14} /> Print
              </button>
              <button className="btn btn-primary no-print" onClick={startCallMode}>
                <Play size={14} /> Start call mode
              </button>
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[12.5px]">
              <span className="font-medium">{formatDayLong(date)}</span>
              <span className="tabular text-muted">
                {doneCount} of {leads.length} completed · daily target {target}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={leads.length} aria-label="Outreach completed">
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(doneCount / Math.max(1, leads.length)) * 100}%` }} />
            </div>
          </div>
          <div className="no-print mt-3 flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-line-strong p-0.5 text-[12px]">
              {(
                [
                  ["plan", "Recommended call plan"],
                  ["priority", "Priority rank"],
                ] as const
              ).map(([v, t]) => (
                <button key={v} className={cn("h-7 rounded-md px-2.5 font-medium", order === v ? "bg-surface-3 text-ink" : "text-muted hover:text-ink")} onClick={() => setOrder(v)} aria-pressed={order === v}>
                  {t}
                </button>
              ))}
            </div>
            <select className="select h-8 w-[130px]" value={show} onChange={(e) => setShow(e.target.value as typeof show)} aria-label="Show">
              <option value="all">All {leads.length}</option>
              <option value="remaining">Remaining</option>
              <option value="done">Completed</option>
            </select>
            <select className="select h-8 w-[170px]" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <label className="relative w-[200px]">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input h-8 pl-8" placeholder="Find a business" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a business" />
            </label>
            <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
              <input type="checkbox" checked={hideClosed} onChange={(e) => setHideClosed(e.target.checked)} /> Hide closed / do-not-contact
            </label>
          </div>
        </div>

        <div className="card overflow-hidden">
          <ul>
            {visible.map(({ lead: l, n }) => {
              const task = tasks[l.id];
              const done = Boolean(task?.done);
              const open = Boolean(expanded[l.id]);
              const due = dueLabel(l.followUpDate);
              const closed = CLOSED_STATUSES.includes(l.status) || l.doNotContact;
              const header =
                order === "plan" && l.callBlock !== lastBlock ? (
                  <li key={`block-${l.callBlock}`} className="sticky top-0 z-[1] border-b border-line bg-surface-2 px-4 py-2 text-[12px]">
                    <span className="font-semibold">
                      {CALL_BLOCKS[l.callBlock]?.label} · {CALL_BLOCKS[l.callBlock]?.time}
                    </span>
                    <span className="ml-2 text-muted">{CALL_BLOCKS[l.callBlock]?.hint}</span>
                    <span className="ml-2 text-muted">
                      ({visible.filter((v) => v.lead.callBlock === l.callBlock && tasks[v.lead.id]?.done).length}/{visible.filter((v) => v.lead.callBlock === l.callBlock).length} done)
                    </span>
                  </li>
                ) : null;
              lastBlock = l.callBlock;
              return [
                header,
                <li key={l.id} className={cn("border-b border-line last:border-0", done && "bg-good-soft/40", closed && "opacity-60")}>
                  <div className="flex items-start gap-3 px-3 py-2.5 sm:px-4">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
                      checked={done}
                      onChange={(e) => saveTask(l.id, { done: e.target.checked })}
                      aria-label={`Mark ${l.name} as completed`}
                    />
                    <span className="tabular mt-0.5 w-7 shrink-0 text-right text-[12px] text-muted" title="Calling order">
                      {n}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link href={`/leads/${l.id}`} className={cn("text-[13.5px] font-medium hover:text-accent-ink", done && "line-through decoration-muted")}>
                          {l.name}
                        </Link>
                        <span className="badge" title="Priority rank">
                          P#{l.priorityRank}
                        </span>
                        <InterestBadge level={l.interestLevel} />
                        <Badge tone="accent">{PRODUCT_LABEL[l.recommendedProduct]}</Badge>
                        {l.status !== "Researched" ? <StatusBadge status={l.status} /> : null}
                        {due ? <Badge tone={due.tone === "neutral" ? "neutral" : due.tone}>{due.text}</Badge> : null}
                      </div>
                      <p className="mt-0.5 truncate text-[12px] text-muted">
                        {l.category} · {l.locality}
                        {l.ownerName ? ` · Ask for ${l.ownerName}` : ""}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {l.phones[0] ? (
                          <>
                            <a href={telHref(l.phones[0].number)} onClick={() => setDialog({ kind: "log", lead: l, startedAt: Date.now(), number: l.phones[0].number })} className="btn btn-sm btn-primary">
                              <PhoneCall size={13} /> <span className="tabular">{l.phones[0].number}</span>
                            </a>
                            {l.phones.length > 1 ? <span className="text-[11.5px] text-muted">+{l.phones.length - 1} more</span> : null}
                          </>
                        ) : (
                          <span className="text-[12px] italic text-muted">No public phone - use email/WhatsApp/website</span>
                        )}
                        <button className="btn btn-sm" onClick={() => setDialog({ kind: "wa", lead: l })} title="WhatsApp">
                          <WhatsappIcon width={14} height={14} />
                        </button>
                        <button className="btn btn-sm" onClick={() => setDialog({ kind: "email", lead: l })} title="Email">
                          <Mail size={14} />
                        </button>
                        <button className="btn btn-sm" onClick={() => setDialog({ kind: "log", lead: l })}>
                          Log outcome
                        </button>
                        <label className="ml-auto flex items-center gap-1 text-[11.5px] text-muted">
                          Follow-up
                          <input type="date" className="input h-7 w-[140px] text-[12px]" value={l.followUpDate ?? ""} onChange={(e) => setFollowUp(l, e.target.value)} aria-label={`Follow-up date for ${l.name}`} />
                        </label>
                      </div>
                      <input
                        className="input mt-1.5 h-7 text-[12.5px]"
                        placeholder="Notes for this call…"
                        value={task?.note ?? ""}
                        onChange={(e) => onRowNote(l.id, e.target.value)}
                        aria-label={`Notes for ${l.name}`}
                      />
                      {open ? (
                        <div className="mt-2 grid gap-2 rounded-lg bg-surface-2 p-3 text-[12.5px] md:grid-cols-2">
                          <div>
                            <div className="section-title mb-1 flex items-center justify-between">
                              Opener <CopyButton text={personalize(l.opener, settings)} className="btn btn-ghost btn-sm h-6 px-1.5 normal-case tracking-normal" />
                            </div>
                            <p>{personalize(l.opener, settings)}</p>
                            <div className="section-title mb-1 mt-3">Best time</div>
                            <p className="text-ink-2">{l.bestTimeToCall}</p>
                          </div>
                          <div>
                            <div className="section-title mb-1 flex items-center justify-between">
                              Pitch <CopyButton text={personalize(l.pitch, settings)} className="btn btn-ghost btn-sm h-6 px-1.5 normal-case tracking-normal" />
                            </div>
                            <p className="text-ink-2">{personalize(l.pitch, settings)}</p>
                          </div>
                          <div className="md:col-span-2">
                            <div className="section-title mb-1">Approach</div>
                            <ol className="list-decimal space-y-0.5 pl-4 text-ink-2">
                              {l.approach.split("\n").map((s) => (
                                <li key={s}>{s}</li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <button className="btn btn-ghost btn-sm mt-0.5 px-1.5" onClick={() => setExpanded((x) => ({ ...x, [l.id]: !open }))} aria-expanded={open} title={open ? "Hide pitch" : "Show opener, pitch and approach"}>
                      {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      <span className="hidden text-[12px] sm:inline">Pitch</span>
                    </button>
                  </div>
                </li>,
              ];
            })}
          </ul>
          {visible.length === 0 ? <p className="p-8 text-center text-[13px] text-muted">Nothing matches these filters.</p> : null}
        </div>
      </div>

      <aside className="space-y-4">
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="card-title">Follow-up reminders</h2>
            <Link href="/followups" className="text-[12px] text-accent-ink hover:underline">
              All
            </Link>
          </div>
          {dueOnDate.length === 0 ? (
            <p className="text-[12.5px] text-muted">No follow-ups due by {formatDayLong(date)}.</p>
          ) : (
            <ul className="space-y-1.5">
              {dueOnDate.slice(0, 12).map((l) => {
                const d = dueLabel(l.followUpDate);
                return (
                  <li key={l.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                    <Link href={`/leads/${l.id}`} className="truncate hover:text-accent-ink">
                      {l.name}
                    </Link>
                    <span className={cn("shrink-0 text-[11.5px]", d?.tone === "bad" ? "text-bad-ink" : "text-muted")}>{d?.text}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="card-title">Day notes</h2>
            <span className="text-[11.5px] text-muted">{noteState === "saving" ? "Saving…" : noteState === "saved" ? "Saved" : ""}</span>
          </div>
          <textarea className="textarea min-h-[160px]" placeholder="Plan for the day, learnings, objections you heard…" value={dayNote} onChange={(e) => onDayNote(e.target.value)} aria-label="Day notes" />
        </section>
        <section className="card p-4 text-[12.5px]">
          <h2 className="card-title mb-2 flex items-center gap-1.5">
            <Zap size={14} className="text-muted" /> How the call plan works
          </h2>
          <ul className="list-disc space-y-1 pl-4 text-ink-2">
            {Object.entries(CALL_BLOCKS).map(([k, b]) => (
              <li key={k}>
                <span className="font-medium text-ink">{b.time}</span> - {b.hint}
              </li>
            ))}
            <li>Inside each block, leads are ordered by priority score (interest, product fit, contactability, size).</li>
            <li>Call mode walks you through them one by one; quick outcomes log the call, set follow-ups and tick the lead off.</li>
          </ul>
        </section>
      </aside>

      {current ? (
        <CallMode
          key={current.lead.id}
          item={current}
          index={focus as number}
          total={queue.length}
          done={Boolean(tasks[current.lead.id]?.done)}
          note={tasks[current.lead.id]?.note ?? ""}
          settings={settings}
          onNote={(v) => onRowNote(current.lead.id, v)}
          onClose={() => setFocus(null)}
          onPrev={() => setFocus((f) => Math.max(0, (f ?? 0) - 1))}
          onNext={() => setFocus((f) => Math.min(queue.length - 1, (f ?? 0) + 1))}
          onSkip={() => {
            saveTask(current.lead.id, { skipped: true });
            setFocus((f) => Math.min(queue.length - 1, (f ?? 0) + 1));
          }}
          onQuick={async (o) => {
            if (await quickLog(current.lead, o)) setFocus((f) => Math.min(queue.length - 1, (f ?? 0) + 1));
          }}
          onCall={(number) => setDialog({ kind: "log", lead: current.lead, startedAt: Date.now(), number })}
          onWhatsApp={() => setDialog({ kind: "wa", lead: current.lead })}
          onEmail={() => setDialog({ kind: "email", lead: current.lead })}
          onLog={() => setDialog({ kind: "log", lead: current.lead })}
        />
      ) : null}

      {dialog?.kind === "log" ? <LogActivityDialog open onClose={() => setDialog(null)} lead={dialog.lead} initialType="CALL" startedAt={dialog.startedAt} target={dialog.number} outreachDate={date} onLogged={onLogged} /> : null}
      {dialog?.kind === "wa" ? <WhatsAppDialog open onClose={() => setDialog(null)} lead={dialog.lead} settings={settings} number={dialog.number} outreachDate={date} onLogged={onLogged} /> : null}
      {dialog?.kind === "email" ? <EmailDialog open onClose={() => setDialog(null)} lead={dialog.lead} settings={settings} smtpEnabled={smtp} outreachDate={date} onLogged={onLogged} /> : null}
    </div>
  );
}

function CallMode({
  item,
  index,
  total,
  done,
  note,
  settings,
  onNote,
  onClose,
  onPrev,
  onNext,
  onSkip,
  onQuick,
  onCall,
  onWhatsApp,
  onEmail,
  onLog,
}: {
  item: { lead: LeadListItem; n: number };
  index: number;
  total: number;
  done: boolean;
  note: string;
  settings: Settings;
  onNote: (v: string) => void;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
  onQuick: (o: (typeof QUICK_OUTCOMES)[number]) => void;
  onCall: (n: string) => void;
  onWhatsApp: () => void;
  onEmail: () => void;
  onLog: () => void;
}) {
  const l = item.lead;
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-bg/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Call mode: ${l.name}`}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <div className="mb-4 flex items-center justify-between gap-2">
          <span className="text-[12.5px] text-muted">
            Call mode · {index + 1} of {total} · calling order #{item.n} · <span className="kbd">←</span> <span className="kbd">→</span> to move, <span className="kbd">Esc</span> to exit
          </span>
          <button className="btn btn-sm" onClick={onClose}>
            <X size={14} /> Exit
          </button>
        </div>
        <div className="card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[22px] font-semibold tracking-[-0.015em]">{l.name}</h2>
              <p className="text-[13px] text-muted">
                {l.category} · {l.subcategory} · {l.locality}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <InterestBadge level={l.interestLevel} />
                <Badge tone="accent">{PRODUCT_LABEL[l.recommendedProduct]}</Badge>
                <StatusBadge status={l.status} />
                {done ? <Badge tone="good">✓ Completed today</Badge> : null}
              </div>
            </div>
            <Link href={`/leads/${l.id}`} className="btn btn-sm" target="_blank">
              Full profile
            </Link>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <div className="section-title mb-1.5">Call</div>
                {l.phones.length ? (
                  <ul className="space-y-1.5">
                    {l.phones.map((p) => (
                      <li key={p.number} className="flex min-w-0 items-center gap-2">
                        <a href={telHref(p.number)} onClick={() => onCall(p.number)} className="btn btn-primary shrink-0">
                          <PhoneCall size={14} /> <span className="tabular">{p.number}</span>
                        </a>
                        <span className="min-w-0 truncate text-[11.5px] text-muted" title={p.label}>
                          {p.type} · {p.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] italic text-muted">No public phone verified - send WhatsApp/email or find the number on Google Maps.</p>
                )}
                <div className="mt-2 flex gap-1.5">
                  <button className="btn btn-sm" onClick={onWhatsApp}>
                    <WhatsappIcon width={14} height={14} /> WhatsApp
                  </button>
                  <button className="btn btn-sm" onClick={onEmail}>
                    <Mail size={14} /> Email
                  </button>
                </div>
              </div>
              <div>
                <div className="section-title mb-1">Ask for</div>
                <p className="text-[13.5px]">{l.ownerName ? `${l.ownerName}${l.ownerRole ? ` - ${l.ownerRole}` : ""}` : "The owner / operations head (no name verified)"}</p>
              </div>
              <div>
                <div className="section-title mb-1">Best time</div>
                <p className="text-[13px] text-ink-2">{l.bestTimeToCall}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg border border-line p-3">
                <div className="section-title mb-1">Opener</div>
                <p className="text-[14px] leading-relaxed">{personalize(l.opener, settings)}</p>
              </div>
              <div className="rounded-lg border border-line p-3">
                <div className="section-title mb-1">Pitch</div>
                <p className="text-[13px] leading-relaxed text-ink-2">{personalize(l.pitch, settings)}</p>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <label className="section-title mb-1.5 block" htmlFor="cm-note">
              Notes during the call
            </label>
            <textarea id="cm-note" className="textarea" value={note} onChange={(e) => onNote(e.target.value)} placeholder="Who you spoke to, what they use today, objections, next step…" />
          </div>

          <div className="mt-4">
            <div className="section-title mb-2">Quick outcome (logs the call, sets status & follow-up, moves to the next lead)</div>
            <div className="flex flex-wrap gap-2">
              {QUICK_OUTCOMES.map((o) => (
                <button key={o.label} className={cn("btn", o.tone === "good" && "btn-good", o.tone === "bad" && "btn-danger")} onClick={() => onQuick(o)}>
                  {o.tone === "good" ? <Check size={14} /> : null}
                  {o.label}
                </button>
              ))}
              <button className="btn" onClick={onLog}>
                Detailed log…
              </button>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
            <button className="btn" onClick={onPrev} disabled={index === 0}>
              <ArrowLeft size={14} /> Previous
            </button>
            <button className="btn btn-ghost" onClick={onSkip}>
              <SkipForward size={14} /> Skip for now
            </button>
            <button className="btn" onClick={onNext} disabled={index >= total - 1}>
              Next <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
