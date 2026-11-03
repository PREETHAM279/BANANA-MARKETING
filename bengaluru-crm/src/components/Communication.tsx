"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Info, Mail, PhoneCall, Plus, Search } from "lucide-react";
import { ACTIVITY_LABEL, PRODUCT_LABEL } from "@/lib/constants";
import { cn, formatDateTime, telHref } from "@/lib/format";
import { emailMessage, personalize, whatsappMessage } from "@/lib/templates";
import type { ActivityItem, LeadListItem } from "@/lib/types";
import { CopyButton, EmailDialog, LogActivityDialog, WhatsAppDialog, type LoggedResult, type Settings } from "./comms";
import { InterestBadge, StatusBadge } from "./ui/primitives";
import { WhatsappIcon } from "./ui/icons";

const TYPES = ["CALL", "WHATSAPP", "EMAIL", "MEETING", "VISIT"];

export function Communication({ leads, activities: initial, settings, smtp }: { leads: LeadListItem[]; activities: ActivityItem[]; settings: Settings; smtp: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [activities, setActivities] = useState(initial);
  const [leadId, setLeadId] = useState(params.get("lead") || leads[0]?.id || "");
  const [type, setType] = useState(params.get("type") || "");
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<null | { kind: "log" | "wa" | "email"; startedAt?: number; number?: string }>(null);
  const lead = leads.find((l) => l.id === leadId) ?? leads[0];

  const log = useMemo(
    () =>
      activities.filter((a) => {
        if (type && a.type !== type) return false;
        if (q && !`${a.businessName} ${a.summary} ${a.outcome} ${a.details}`.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      }),
    [activities, type, q],
  );

  const onLogged = (r: LoggedResult) => {
    setActivities((a) => [{ ...r.activity, businessName: r.lead.name }, ...a]);
    router.refresh();
  };

  const wa = lead ? whatsappMessage(lead, settings, "intro") : "";
  const em = lead ? emailMessage(lead, settings, "intro") : null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[440px_minmax(0,1fr)]">
      <div className="space-y-4">
        <section className="card p-4">
          <h2 className="card-title mb-3">Compose for a business</h2>
          <label className="block">
            <span className="label">Business</span>
            <select className="select" value={lead?.id} onChange={(e) => setLeadId(e.target.value)}>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  #{l.priorityRank} {l.name} - {l.category}
                </option>
              ))}
            </select>
          </label>
          {lead ? (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <InterestBadge level={lead.interestLevel} />
                <span className="badge bg-accent-soft text-accent-ink border-transparent">{PRODUCT_LABEL[lead.recommendedProduct]}</span>
                <StatusBadge status={lead.status} />
                <Link href={`/leads/${lead.id}`} className="ml-auto text-[12px] text-accent-ink hover:underline">
                  Open profile
                </Link>
              </div>
              <p className="mt-2 text-[12.5px] text-muted">Greeting: {lead.ownerName ? `${lead.ownerName} (sourced)` : `${lead.name} team - no verified owner name`}</p>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {lead.phones[0] ? (
                  <a className="btn btn-primary btn-sm" href={telHref(lead.phones[0].number)} onClick={() => setDialog({ kind: "log", startedAt: Date.now(), number: lead.phones[0].number })}>
                    <PhoneCall size={13} /> Call
                  </a>
                ) : (
                  <button className="btn btn-sm" disabled title="No public phone">
                    <PhoneCall size={13} /> No phone
                  </button>
                )}
                <button className="btn btn-sm" onClick={() => setDialog({ kind: "wa" })}>
                  <WhatsappIcon width={14} height={14} /> WhatsApp
                </button>
                <button className="btn btn-sm" onClick={() => setDialog({ kind: "email" })}>
                  <Mail size={13} /> Email
                </button>
              </div>
              <button className="btn btn-sm mt-1.5 w-full" onClick={() => setDialog({ kind: "log" })}>
                <Plus size={13} /> Log a call, meeting or reply
              </button>

              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-line p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="section-title">Call script · opener</span>
                    <CopyButton text={personalize(lead.opener, settings)} className="btn btn-ghost btn-sm h-6 px-1.5" />
                  </div>
                  <p className="text-[13px]">{personalize(lead.opener, settings)}</p>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="section-title">WhatsApp intro (preview)</span>
                    <CopyButton text={wa} className="btn btn-ghost btn-sm h-6 px-1.5" />
                  </div>
                  <p className="whitespace-pre-wrap text-[12.5px] text-ink-2">{wa}</p>
                </div>
                {em ? (
                  <div className="rounded-lg border border-line p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="section-title">Email intro (preview)</span>
                      <CopyButton text={`Subject: ${em.subjects[0]}\n\n${em.body}`} className="btn btn-ghost btn-sm h-6 px-1.5" />
                    </div>
                    <p className="text-[12.5px] font-medium">Subject: {em.subjects[0]}</p>
                    <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-ink-2">{em.body}</p>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </section>

        <section className="card p-4 text-[12.5px] leading-relaxed text-ink-2">
          <h2 className="card-title mb-2 flex items-center gap-1.5">
            <Info size={14} className="text-muted" /> What actually happens when you click
          </h2>
          <ul className="space-y-2">
            <li>
              <span className="font-medium text-ink">Call</span> opens a <code>tel:</code> link. On a Mac this rings through your iPhone (Continuity / FaceTime “Calls from iPhone”). The CRM starts a timer and asks you to record the outcome - it never assumes the call happened.
            </li>
            <li>
              <span className="font-medium text-ink">WhatsApp</span> opens WhatsApp Desktop / Web with the message typed in. You press send; then you confirm in the CRM. Fully automatic sending needs the paid WhatsApp Business Platform (Meta business verification, pre-approved templates and recipient opt-in) - not suitable for cold outreach.
            </li>
            <li>
              <span className="font-medium text-ink">Email</span> opens your Mail app or Gmail with recipient, subject and body filled in, then asks you to confirm.{" "}
              {smtp ? <span className="font-medium text-good-ink">SMTP is configured, so “Send now” really sends and logs the message ID.</span> : <>Add SMTP details in <code>.env.local</code> to send directly from the CRM (see Settings).</>}
            </li>
            <li>
              <span className="font-medium text-ink">Rules worth following:</span> call business numbers published for enquiries, introduce yourself honestly, and stop immediately if someone asks you not to contact them (tick “Do not contact” on their profile).
            </li>
          </ul>
        </section>
      </div>

      <section className="card min-w-0">
        <div className="card-header flex-wrap">
          <h2 className="card-title">Communication log</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-line-strong p-0.5 text-[12px]">
              {["", ...TYPES].map((t) => (
                <button key={t || "all"} className={cn("h-7 rounded-md px-2.5 font-medium", type === t ? "bg-surface-3 text-ink" : "text-muted hover:text-ink")} onClick={() => setType(t)}>
                  {t ? ACTIVITY_LABEL[t] : "All"}
                </button>
              ))}
            </div>
            <label className="relative w-[200px]">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input className="input h-8 pl-8" placeholder="Search log" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search log" />
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[12.5px]">
            <thead>
              <tr className="border-y border-line text-left text-[11.5px] uppercase tracking-wide text-muted">
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Business</th>
                <th className="px-4 py-2 font-medium">Channel</th>
                <th className="px-4 py-2 font-medium">Outcome</th>
                <th className="px-4 py-2 font-medium">Summary</th>
              </tr>
            </thead>
            <tbody>
              {log.map((a) => (
                <tr key={a.id} className="border-b border-line align-top last:border-0 hover:bg-surface-2">
                  <td className="whitespace-nowrap px-4 py-2 text-muted">{formatDateTime(a.occurredAt)}</td>
                  <td className="px-4 py-2">
                    <Link href={`/leads/${a.businessId}`} className="font-medium hover:text-accent-ink">
                      {a.businessName}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span className="badge">{ACTIVITY_LABEL[a.type] ?? a.type}</span>
                  </td>
                  <td className="px-4 py-2">{a.outcome}</td>
                  <td className="px-4 py-2 text-ink-2">
                    {a.summary}
                    {a.details ? <span className="mt-0.5 line-clamp-2 block text-[11.5px] text-muted">{a.details}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {log.length === 0 ? <p className="p-8 text-center text-[13px] text-muted">No calls, messages or meetings logged yet.</p> : null}
        </div>
      </section>

      {lead && dialog?.kind === "log" ? <LogActivityDialog open onClose={() => setDialog(null)} lead={lead} initialType="CALL" startedAt={dialog.startedAt} target={dialog.number} onLogged={onLogged} /> : null}
      {lead && dialog?.kind === "wa" ? <WhatsAppDialog open onClose={() => setDialog(null)} lead={lead} settings={settings} onLogged={onLogged} /> : null}
      {lead && dialog?.kind === "email" ? <EmailDialog open onClose={() => setDialog(null)} lead={lead} settings={settings} smtpEnabled={smtp} onLogged={onLogged} /> : null}
    </div>
  );
}
