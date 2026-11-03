"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CalendarClock, Check, Clock, PhoneCall, Users } from "lucide-react";
import { CLOSED_STATUSES } from "@/lib/constants";
import { addDays, cn, dueLabel, formatDay, telHref, todayISO } from "@/lib/format";
import { api } from "@/lib/client";
import type { LeadListItem } from "@/lib/types";
import { LogActivityDialog, WhatsAppDialog, type LoggedResult, type Settings } from "./comms";
import { EmptyState, InterestBadge, StatusBadge } from "./ui/primitives";
import { WhatsappIcon } from "./ui/icons";
import { useToast } from "./ui/toast";

export function Followups({ leads: initial, settings, meetings }: { leads: LeadListItem[]; settings: Settings; meetings: (LeadListItem & { meetingAt: string })[] }) {
  const toast = useToast();
  const router = useRouter();
  const [leads, setLeads] = useState(initial);
  const [dialog, setDialog] = useState<null | { kind: "log" | "wa"; lead: LeadListItem; startedAt?: number; number?: string }>(null);
  const today = todayISO();

  const groups = useMemo(() => {
    const open = leads.filter((l) => l.followUpDate && !CLOSED_STATUSES.includes(l.status));
    const by = (pred: (d: string) => boolean) => open.filter((l) => pred(l.followUpDate as string)).sort((a, b) => (a.followUpDate as string).localeCompare(b.followUpDate as string) || a.priorityRank - b.priorityRank);
    return [
      { key: "overdue", title: "Overdue", tone: "bad", items: by((d) => d < today) },
      { key: "today", title: "Today", tone: "warn", items: by((d) => d === today) },
      { key: "tomorrow", title: "Tomorrow", tone: "accent", items: by((d) => d === addDays(today, 1)) },
      { key: "week", title: "Next 7 days", tone: "neutral", items: by((d) => d > addDays(today, 1) && d <= addDays(today, 7)) },
      { key: "later", title: "Later", tone: "neutral", items: by((d) => d > addDays(today, 7)) },
    ];
  }, [leads, today]);

  const update = async (l: LeadListItem, data: Record<string, unknown>, msg: string) => {
    try {
      const s = await api<LeadListItem>(`/api/businesses/${l.id}`, { method: "PATCH", body: data });
      setLeads((ls) => ls.map((x) => (x.id === l.id ? s : x)));
      toast(msg);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not update", "error");
    }
  };
  const onLogged = (r: LoggedResult) => {
    setLeads((ls) => ls.map((x) => (x.id === r.lead.id ? r.lead : x)));
    router.refresh();
  };
  const total = groups.reduce((s, g) => s + g.items.length, 0);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        {total === 0 ? (
          <div className="card">
            <EmptyState icon={<CalendarClock size={22} />} title="No follow-ups scheduled">
              Set a follow-up date on any lead (or when you log a call) and it will appear here.
            </EmptyState>
          </div>
        ) : null}
        {groups
          .filter((g) => g.items.length)
          .map((g) => (
            <section key={g.key} className="card">
              <div className="card-header">
                <h2 className={cn("card-title", g.tone === "bad" && "text-bad-ink", g.tone === "warn" && "text-warn-ink")}>
                  {g.title} <span className="ml-1 font-normal text-muted">{g.items.length}</span>
                </h2>
              </div>
              <ul className="divide-y divide-[var(--line)]">
                {g.items.map((l) => {
                  const due = dueLabel(l.followUpDate);
                  const phone = l.phones[0];
                  return (
                    <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-[220px] flex-1">
                        <Link href={`/leads/${l.id}`} className="text-[13.5px] font-medium hover:text-accent-ink">
                          {l.name}
                        </Link>
                        <p className="text-[12px] text-muted">
                          {l.category} · {l.locality} · {due?.text ?? formatDay(l.followUpDate)}
                        </p>
                        {l.followUpNote || l.nextAction ? <p className="mt-0.5 text-[12.5px] text-ink-2">→ {l.followUpNote || l.nextAction}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={l.status} />
                        <InterestBadge level={l.interestLevel} />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {phone ? (
                          <a href={telHref(phone.number)} className="btn btn-sm btn-primary" onClick={() => setDialog({ kind: "log", lead: l, startedAt: Date.now(), number: phone.number })}>
                            <PhoneCall size={13} /> Call
                          </a>
                        ) : null}
                        <button className="btn btn-sm" onClick={() => setDialog({ kind: "wa", lead: l })}>
                          <WhatsappIcon width={14} height={14} />
                        </button>
                        <button className="btn btn-sm" onClick={() => update(l, { followUpDate: addDays(today, 1) }, `${l.name}: moved to tomorrow`)} title="Snooze to tomorrow">
                          +1d
                        </button>
                        <button className="btn btn-sm" onClick={() => update(l, { followUpDate: addDays(today, 3) }, `${l.name}: moved by 3 days`)} title="Snooze 3 days">
                          +3d
                        </button>
                        <button className="btn btn-sm" onClick={() => update(l, { followUpDate: null }, `${l.name}: follow-up cleared`)} title="Mark follow-up done (clears the date)">
                          <Check size={13} /> Done
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
      </div>
      <aside className="space-y-4">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title flex items-center gap-2">
              <Users size={15} className="text-muted" /> Upcoming meetings
            </h2>
          </div>
          <ul className="px-2 pb-2">
            {meetings.length === 0 ? <li className="px-2 py-5 text-center text-[12.5px] text-muted">No meetings scheduled yet.</li> : null}
            {meetings.map((m) => (
              <li key={m.id}>
                <Link href={`/leads/${m.id}`} className="block rounded-lg px-2 py-2 hover:bg-surface-2">
                  <span className="block text-[13px] font-medium">{m.name}</span>
                  <span className="flex items-center gap-1 text-[12px] text-muted">
                    <Clock size={12} /> {m.meetingAt.replace("T", " · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-4 text-[12.5px] text-ink-2">
          <p className="font-medium text-ink">How follow-ups work</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Set a date on a lead profile, in Tomorrow&apos;s Outreach, or when you log a call.</li>
            <li>“No answer” and “call back” outcomes suggest a follow-up date automatically.</li>
            <li>Overdue items show in red on the dashboard and in the sidebar count.</li>
          </ul>
        </section>
      </aside>

      {dialog?.kind === "log" ? <LogActivityDialog open onClose={() => setDialog(null)} lead={dialog.lead} initialType="CALL" startedAt={dialog.startedAt} target={dialog.number} onLogged={onLogged} /> : null}
      {dialog?.kind === "wa" ? <WhatsAppDialog open onClose={() => setDialog(null)} lead={dialog.lead} settings={settings} onLogged={onLogged} /> : null}
    </div>
  );
}
