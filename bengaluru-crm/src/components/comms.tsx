"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, ExternalLink, Mail, PhoneCall, Send } from "lucide-react";
import { CALL_OUTCOMES, EMAIL_OUTCOMES, MEETING_OUTCOMES, STATUSES, VISIT_OUTCOMES, WHATSAPP_OUTCOMES, suggestStatus } from "@/lib/constants";
import { addDays, gmailComposeHref, mailtoHref, telHref, todayISO, waHref } from "@/lib/format";
import { api } from "@/lib/client";
import { MESSAGE_KINDS, emailMessage, whatsappMessage, type MessageKind } from "@/lib/templates";
import type { ActivityItem, LeadListItem } from "@/lib/types";
import { Field, FieldGroup, Modal } from "./ui/primitives";
import { useToast } from "./ui/toast";
import { WhatsappIcon } from "./ui/icons";

export type Settings = Record<string, string>;
export type LoggedResult = { activity: ActivityItem; lead: LeadListItem };

const OUTCOMES: Record<string, readonly string[]> = {
  CALL: CALL_OUTCOMES,
  WHATSAPP: WHATSAPP_OUTCOMES,
  EMAIL: EMAIL_OUTCOMES,
  MEETING: MEETING_OUTCOMES,
  VISIT: VISIT_OUTCOMES,
  NOTE: ["General note"],
};

function localDateTimeValue(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function CopyButton({ text, label = "Copy", className = "btn btn-sm" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
      {done ? "Copied" : label}
    </button>
  );
}

/** Log a call / message / meeting / visit. Nothing is marked as done unless you save it here. */
export function LogActivityDialog({
  open,
  onClose,
  lead,
  initialType = "CALL",
  startedAt,
  target,
  outreachDate,
  onLogged,
}: {
  open: boolean;
  onClose: () => void;
  lead: LeadListItem;
  initialType?: string;
  startedAt?: number | null;
  target?: string;
  outreachDate?: string;
  onLogged: (r: LoggedResult) => void;
}) {
  const toast = useToast();
  const [type, setType] = useState(initialType);
  const [outcome, setOutcome] = useState("");
  const [details, setDetails] = useState("");
  const [when, setWhen] = useState(localDateTimeValue());
  const [followUp, setFollowUp] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [status, setStatus] = useState("");
  const [statusTouched, setStatusTouched] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setOutcome("");
    setDetails("");
    setWhen(localDateTimeValue());
    setFollowUp("");
    setNextAction("");
    setStatus("");
    setStatusTouched(false);
  }, [open, initialType]);

  useEffect(() => {
    if (!open || !startedAt) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [open, startedAt]);

  useEffect(() => {
    if (statusTouched) return;
    setStatus(suggestStatus(type, outcome, lead.status) ?? "");
  }, [type, outcome, lead.status, statusTouched]);

  useEffect(() => {
    const o = outcome.toLowerCase();
    if (!followUp && (o.includes("call back") || o.includes("not now") || o.includes("no answer") || o.includes("busy") || o.includes("needs follow-up"))) {
      setFollowUp(addDays(todayISO(), o.includes("no answer") || o.includes("busy") ? 1 : 3));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  const save = async () => {
    if (!outcome) {
      toast("Choose an outcome first", "error");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        type,
        outcome,
        details,
        occurredAt: new Date(when).toISOString(),
        channelTarget: target,
        outreachDate,
      };
      if (type === "CALL" && startedAt) body.durationSec = elapsed;
      if (status) body.setStatus = status;
      if (followUp) body.followUpDate = followUp;
      if (nextAction) body.nextAction = nextAction;
      const res = await api<LoggedResult>(`/api/businesses/${lead.id}/activities`, { body });
      toast(`${type === "CALL" ? "Call" : type.charAt(0) + type.slice(1).toLowerCase()} logged for ${lead.name}`);
      onLogged(res);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Record conversation · ${lead.name}`}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save to timeline"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {type === "CALL" && startedAt ? (
          <div className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-[12.5px] text-accent-ink">
            <PhoneCall size={14} /> Call started {mm} ago{target ? ` · ${target}` : ""}. Fill this in when you hang up.
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className="select" value={type} onChange={(e) => (setType(e.target.value), setOutcome(""))}>
              <option value="CALL">Phone call</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Email</option>
              <option value="MEETING">Meeting / demo</option>
              <option value="VISIT">In-person visit</option>
              <option value="NOTE">Note only</option>
            </select>
          </Field>
          <Field label="When">
            <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
        </div>
        <FieldGroup label="Outcome">
          <div className="flex flex-wrap gap-1.5">
            {(OUTCOMES[type] ?? []).map((o) => (
              <button key={o} type="button" onClick={() => setOutcome(o)} aria-pressed={outcome === o} className={outcome === o ? "btn btn-sm btn-primary" : "btn btn-sm"}>
                {o}
              </button>
            ))}
          </div>
        </FieldGroup>
        <Field label="Conversation notes" hint="What they said, who you spoke to, objections, next steps.">
          <textarea className="textarea min-h-[110px]" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="e.g. Spoke to the operations manager. Uses a biometric at 2 outlets, rest on registers. Asked for pricing for 8 outlets." />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Update status to">
            <select className="select" value={status} onChange={(e) => (setStatus(e.target.value), setStatusTouched(true))}>
              <option value="">Keep “{lead.status}”</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Follow-up date">
            <input className="input" type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
          </Field>
        </div>
        <Field label="Next action (optional)">
          <input className="input" value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="e.g. Send pricing for 8 outlets on WhatsApp" />
        </Field>
      </div>
    </Modal>
  );
}

/** WhatsApp: generate, edit, open WhatsApp with the text, then confirm whether you actually sent it. */
export function WhatsAppDialog({
  open,
  onClose,
  lead,
  settings,
  number,
  outreachDate,
  onLogged,
  extra,
}: {
  open: boolean;
  onClose: () => void;
  lead: LeadListItem;
  settings: Settings;
  number?: string;
  outreachDate?: string;
  onLogged: (r: LoggedResult) => void;
  extra?: { followUpDate?: string | null; meetingAt?: string | null };
}) {
  const toast = useToast();
  const mobiles = lead.phones.filter((p) => p.type === "mobile");
  const [kind, setKind] = useState<MessageKind>("intro");
  const [to, setTo] = useState(number || mobiles[0]?.number || lead.phones[0]?.number || "");
  const [text, setText] = useState("");
  const [stage, setStage] = useState<"compose" | "confirm">("compose");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStage("compose");
    setTo(number || mobiles[0]?.number || lead.phones[0]?.number || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, number]);

  useEffect(() => {
    if (open) setText(whatsappMessage(lead, settings, kind, extra));
  }, [open, kind, lead, settings, extra]);

  const selected = lead.phones.find((p) => p.number === to);
  const isLandline = selected ? selected.type === "landline" : false;

  const openWhatsApp = () => {
    if (!to) {
      toast("Enter a WhatsApp number", "error");
      return;
    }
    window.open(waHref(to, text), "_blank", "noopener");
    setStage("confirm");
  };

  const confirm = async (outcome: "Sent" | null) => {
    if (!outcome) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const res = await api<LoggedResult>(`/api/businesses/${lead.id}/activities`, {
        body: { type: "WHATSAPP", outcome, summary: `WhatsApp ${MESSAGE_KINDS.find((k) => k.id === kind)?.label.toLowerCase()} sent to ${to}`, details: text, channelTarget: to, setStatus: suggestStatus("WHATSAPP", "Sent", lead.status) ?? undefined, outreachDate },
      });
      toast("WhatsApp message logged as sent");
      onLogged(res);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={
        <span className="flex items-center gap-2">
          <WhatsappIcon width={18} height={18} /> WhatsApp · {lead.name}
        </span>
      }
      footer={
        stage === "compose" ? (
          <>
            <CopyButton text={text} label="Copy text" className="btn" />
            <button className="btn btn-primary" onClick={openWhatsApp}>
              <ExternalLink size={14} /> Open in WhatsApp
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={() => confirm(null)} disabled={saving}>
              No, I didn&apos;t send it
            </button>
            <button className="btn btn-good" onClick={() => confirm("Sent")} disabled={saving}>
              <Check size={14} /> Yes, I sent it
            </button>
          </>
        )
      }
    >
      {stage === "compose" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Message type">
              <select className="select" value={kind} onChange={(e) => setKind(e.target.value as MessageKind)}>
                {MESSAGE_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Send to (WhatsApp number)">
              <input className="input tabular" list={`wa-${lead.id}`} value={to} onChange={(e) => setTo(e.target.value)} placeholder="+91 98xxx xxxxx" />
              <datalist id={`wa-${lead.id}`}>
                {lead.phones.map((p) => (
                  <option key={p.number} value={p.number}>
                    {p.type} · {p.label}
                  </option>
                ))}
              </datalist>
            </Field>
          </div>
          {isLandline ? (
            <div className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn-ink">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> This looks like a Bengaluru landline (080). Landlines usually don&apos;t have WhatsApp - call first and ask for a WhatsApp number.
            </div>
          ) : null}
          {!settings.yourName || !settings.yourCompany ? (
            <div className="rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">
              Tip: add your name and company in <a className="link" href="/settings">Settings</a> so messages are signed correctly.
            </div>
          ) : null}
          <Field label="Message (edit freely before sending)">
            <textarea className="textarea min-h-[200px]" value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <p className="text-[11.5px] text-muted">
            “Open in WhatsApp” opens WhatsApp Desktop or WhatsApp Web with this text filled in. You press send there. Only send business messages to numbers published for enquiries, and stop if someone asks you to.
          </p>
        </div>
      ) : (
        <div className="space-y-2 py-2 text-[13.5px]">
          <p className="font-medium">Did you send the message in WhatsApp?</p>
          <p className="text-muted">The CRM can&apos;t see inside WhatsApp, so it only records the message as sent when you confirm. If you changed the text in WhatsApp, the CRM keeps the version shown here.</p>
        </div>
      )}
    </Modal>
  );
}

/** Email: generate, edit, then open in Mail/Gmail (confirm afterwards) or send directly via SMTP if configured. */
export function EmailDialog({
  open,
  onClose,
  lead,
  settings,
  emails,
  smtpEnabled,
  outreachDate,
  onLogged,
  extra,
}: {
  open: boolean;
  onClose: () => void;
  lead: LeadListItem;
  settings: Settings;
  emails?: string[];
  smtpEnabled: boolean;
  outreachDate?: string;
  onLogged: (r: LoggedResult) => void;
  extra?: { followUpDate?: string | null; meetingAt?: string | null };
}) {
  const toast = useToast();
  const options = useMemo(() => [...new Set([...(emails ?? []), ...(lead.email ? [lead.email] : [])])], [emails, lead.email]);
  const [kind, setKind] = useState<MessageKind>("intro");
  const [to, setTo] = useState(options[0] ?? "");
  const [subject, setSubject] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [stage, setStage] = useState<"compose" | "confirm">("compose");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStage("compose");
    setTo(options[0] ?? "");
  }, [open, options]);

  useEffect(() => {
    if (!open) return;
    const m = emailMessage(lead, settings, kind, extra);
    setSubjects(m.subjects);
    setSubject(m.subjects[0]);
    setBody(m.body);
  }, [open, kind, lead, settings, extra]);

  const log = async (outcome: string) => {
    setBusy(true);
    try {
      const res = await api<LoggedResult>(`/api/businesses/${lead.id}/activities`, {
        body: { type: "EMAIL", outcome, summary: `Email: ${subject}`, details: `To: ${to}\nSubject: ${subject}\n\n${body}`, channelTarget: to, setStatus: suggestStatus("EMAIL", outcome, lead.status) ?? undefined, outreachDate },
      });
      toast("Email logged as sent");
      onLogged(res);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  };

  const sendSMTP = async () => {
    setBusy(true);
    try {
      const res = await api<LoggedResult & { messageId: string }>(`/api/email/send`, { body: { businessId: lead.id, to, subject, body } });
      toast(`Email sent to ${to}`);
      onLogged(res);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not send", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={
        <span className="flex items-center gap-2">
          <Mail size={17} /> Email · {lead.name}
        </span>
      }
      footer={
        stage === "compose" ? (
          <>
            <CopyButton text={`Subject: ${subject}\n\n${body}`} label="Copy" className="btn" />
            <a className="btn" href={gmailComposeHref(to, subject, body)} target="_blank" rel="noopener noreferrer" onClick={() => setStage("confirm")}>
              <ExternalLink size={14} /> Open in Gmail
            </a>
            <a className="btn" href={mailtoHref(to, subject, body)} onClick={() => setStage("confirm")}>
              <Mail size={14} /> Open in Mail app
            </a>
            {smtpEnabled ? (
              <button className="btn btn-primary" onClick={sendSMTP} disabled={busy || !to}>
                <Send size={14} /> {busy ? "Sending…" : "Send now"}
              </button>
            ) : null}
          </>
        ) : (
          <>
            <button className="btn" onClick={() => setStage("compose")} disabled={busy}>
              Not yet - back
            </button>
            <button className="btn" onClick={onClose} disabled={busy}>
              I didn&apos;t send it
            </button>
            <button className="btn btn-good" onClick={() => log("Sent")} disabled={busy}>
              <Check size={14} /> Yes, I sent it
            </button>
          </>
        )
      }
    >
      {stage === "compose" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email type">
              <select className="select" value={kind} onChange={(e) => setKind(e.target.value as MessageKind)}>
                {MESSAGE_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="To" hint={options.length ? "From the official website / public listings" : "No public email was verified - get one on the call"}>
              <input className="input" list={`em-${lead.id}`} value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@company.com" />
              <datalist id={`em-${lead.id}`}>
                {options.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </Field>
          </div>
          <div>
            <Field label="Subject">
              <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Subject suggestions">
              {subjects.map((s) => (
                <button key={s} type="button" className="badge hover:border-line-strong" onClick={() => setSubject(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Field label="Message">
            <textarea className="textarea min-h-[260px]" value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <p className="text-[11.5px] text-muted">
            {smtpEnabled
              ? "“Send now” sends through your SMTP account and is logged automatically. Mail app / Gmail open a pre-filled draft - you send it there, then confirm here."
              : "Mail app / Gmail open a pre-filled draft; you press send there, then confirm here. To send directly from the CRM, add SMTP details (Settings → Email sending)."}
          </p>
        </div>
      ) : (
        <div className="space-y-2 py-2 text-[13.5px]">
          <p className="font-medium">Did you send the email?</p>
          <p className="text-muted">The CRM records the email as sent only after you confirm. If your mail app didn&apos;t open, use “Copy” and paste into any mail client.</p>
        </div>
      )}
    </Modal>
  );
}

/** Phone number row with Call (tel:) and WhatsApp buttons. Calling opens the log dialog with a running timer. */
export function PhoneActions({
  lead,
  onCall,
  onWhatsApp,
  compact,
}: {
  lead: LeadListItem;
  onCall: (number: string) => void;
  onWhatsApp: (number: string) => void;
  compact?: boolean;
}) {
  if (!lead.phones.length) return <p className="text-[12.5px] italic text-muted">No public phone verified.</p>;
  const list = compact ? lead.phones.slice(0, 2) : lead.phones;
  return (
    <ul className="space-y-2">
      {list.map((p) => (
        <li key={p.number} className="flex flex-wrap items-center gap-2">
          <a href={telHref(p.number)} onClick={() => onCall(p.number)} className="btn btn-sm btn-primary" title={`Call ${p.number}`}>
            <PhoneCall size={13} /> Call
          </a>
          <button type="button" className="btn btn-sm" onClick={() => onWhatsApp(p.number)} title={p.type === "landline" ? "Landline - WhatsApp unlikely" : "WhatsApp this number"}>
            <WhatsappIcon width={14} height={14} /> {p.type === "landline" ? <span className="text-muted">WhatsApp?</span> : "WhatsApp"}
          </button>
          <span className="min-w-0">
            <span className="tabular block text-[13.5px] font-semibold">{p.number}</span>
            <span className="block truncate text-[11.5px] text-muted" title={p.label}>
              {p.type === "landline" ? "Landline" : "Mobile"} · {p.label}
            </span>
          </span>
        </li>
      ))}
      {compact && lead.phones.length > 2 ? <li className="text-[11.5px] text-muted">+{lead.phones.length - 2} more numbers on the profile</li> : null}
    </ul>
  );
}
