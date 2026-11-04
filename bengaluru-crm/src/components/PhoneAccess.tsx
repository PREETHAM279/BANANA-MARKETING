"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, LogOut, QrCode, RefreshCw, Smartphone, Wifi } from "lucide-react";
import { api } from "@/lib/client";
import { cn, formatDateTime, relativeTime } from "@/lib/format";
import { CopyButton } from "./comms";
import { useToast } from "./ui/toast";

type Address = { kind: string; label: string; url: string; listening: boolean };
type Session = { id: string; device: string; ip: string; via: string; createdAt: string; lastSeenAt: string; expiresAt: string };
type MacStatus = {
  available: true;
  client: "mac";
  enabled: boolean;
  port: number;
  passcode: { set: boolean; setAt?: string; digitsOnly?: boolean };
  addresses: Address[];
  tailscale: { installed: boolean; running: boolean; https: boolean; funnel: boolean };
  sessions: Session[];
  security: { failedLastHour: number; lockedUntil: string | null };
  newPasscode?: string;
};
type PhoneStatus = { available: true; client: "phone"; device: string; via: string; signedInAt: string; expiresAt: string; https: boolean };
type PairLink = { kind: string; label: string; url: string; link: string; svg: string };

const HINT: Record<string, string> = {
  lan: "Phone on the same Wi-Fi as this Mac",
  mdns: "Same Wi-Fi; keeps working if the Mac's IP address changes (best on iPhone)",
  "tailscale-https": "Anywhere, with Tailscale on both devices · secure address, voice notes work",
  "tailscale-name": "Anywhere, with Tailscale on both devices",
  tailscale: "Anywhere, with Tailscale on both devices",
};

const groupDigits = (p: string) => (/^\d+$/.test(p) ? p.replace(/(\d{4})(?=\d)/g, "$1 ") : p);

function Countdown({ until, onExpire }: { until: string; onExpire: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Date.parse(until) - now);
  useEffect(() => {
    if (left === 0) onExpire();
  }, [left, onExpire]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span className="tabular">
      {m}:{String(s).padStart(2, "0")}
    </span>
  );
}

export function PhoneAccess({ client }: { client: "mac" | "phone" }) {
  const toast = useToast();
  const [status, setStatus] = useState<MacStatus | PhoneStatus | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [pair, setPair] = useState<{ expiresAt: string; links: PairLink[] } | null>(null);
  const [pairKind, setPairKind] = useState("");
  const [custom, setCustom] = useState<{ open: boolean; value: string; signOutAll: boolean }>({ open: false, value: "", signOutAll: false });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/__crm/phone/status", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setStatus(await res.json());
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15000);
    return () => clearInterval(t);
  }, [load]);

  const call = async <T,>(name: string, url: string, body: unknown, done?: (r: T) => void) => {
    setBusy(name);
    try {
      const r = await api<T>(url, { body });
      done?.(r);
      return r;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong", "error");
      return null;
    } finally {
      setBusy("");
    }
  };

  const applyMac = (r: MacStatus) => {
    setStatus(r);
    if (r.newPasscode) setNewPasscode(r.newPasscode);
  };

  const showQr = async () => {
    const r = await call<{ expiresAt: string; links: PairLink[] }>("pair", "/__crm/phone/pair", {});
    if (r) {
      setPair(r);
      setPairKind((k) => (r.links.some((l) => l.kind === k) ? k : r.links[0]?.kind ?? ""));
    }
  };

  const expirePair = useCallback(() => setPair(null), []);

  if (unavailable) {
    return (
      <section className="card p-5" id="phone">
        <Header on={false} />
        <p className="text-[12.5px] text-muted">
          Phone access works when the CRM is started with <b className="text-ink-2">start-crm.command</b> (or <code>npm start</code>). It isn&apos;t available in developer mode (<code>npm run dev</code>).
        </p>
      </section>
    );
  }
  if (!status) {
    return (
      <section className="card p-5" id="phone">
        <Header on={false} />
        <p className="flex items-center gap-2 text-[12.5px] text-muted">
          <Loader2 size={14} className="animate-spin" /> Checking…
        </p>
      </section>
    );
  }

  if (status.client === "phone" || client === "phone") {
    const s = status as PhoneStatus;
    return (
      <section className="card p-5" id="phone">
        <Header on />
        <p className="mb-3 text-[13px]">
          You&apos;re using the CRM on <b>{s.device || "this device"}</b>, connected to your Mac {s.via ? `via ${s.via}` : ""}. Signed in {formatDateTime(s.signedInAt)}.
        </p>
        <ul className="mb-4 space-y-1.5 text-[12.5px] text-muted">
          <li>• Call, WhatsApp and Email buttons open this phone&apos;s own apps. Record the outcome when you come back.</li>
          <li>• Add the CRM to your Home Screen: Safari → Share → “Add to Home Screen” (Chrome: ⋮ → “Add to Home screen”). Enter the passcode once more there.</li>
          <li>• Your Mac must be awake with the CRM running.</li>
          {!s.https ? <li>• Voice notes need the secure Tailscale address; everything else works here.</li> : null}
        </ul>
        <button
          className="btn"
          disabled={busy !== ""}
          onClick={async () => {
            setBusy("logout");
            try {
              await fetch("/__crm/logout", { method: "POST", headers: { Accept: "application/json" } });
            } finally {
              window.location.assign("/__crm/login?bye=1");
            }
          }}
        >
          <LogOut size={14} /> Sign out this phone
        </button>
      </section>
    );
  }

  const m = status as MacStatus;
  const lan = m.addresses.filter((a) => a.kind === "lan");
  const notListening = m.addresses.filter((a) => (a.kind === "lan" || a.kind === "tailscale") && !a.listening);
  const selected = pair?.links.find((l) => l.kind === pairKind) ?? pair?.links[0];

  return (
    <section className="card p-5" id="phone">
      <Header on={m.enabled} />
      {!m.enabled ? (
        <>
          <p className="mb-3 text-[12.5px] text-muted">
            Open this CRM on your phone while it keeps running on this Mac. Your data stays here; the phone connects over your Wi-Fi (or Tailscale, from anywhere) and must sign in with a passcode. Calls, WhatsApp and email then open straight in your phone&apos;s apps.
          </p>
          <button className="btn btn-primary" disabled={busy !== ""} onClick={() => call<MacStatus>("enable", "/__crm/phone/enable", { enabled: true }, applyMac)}>
            {busy === "enable" ? <Loader2 size={14} className="animate-spin" /> : <Smartphone size={14} />} Turn on phone access
          </button>
          <p className="mt-2 text-[11.5px] text-muted">Use it on your home or office Wi-Fi, not on public Wi-Fi. If macOS asks whether “node” may accept incoming connections, click Allow.</p>
        </>
      ) : (
        <div className="space-y-5">
          {newPasscode ? (
            <div className="rounded-lg border border-accent/30 bg-accent-soft p-3.5" role="status">
              <div className="text-[12px] font-medium text-accent-ink">Your phone passcode</div>
              <div className="tabular mt-0.5 text-[26px] font-semibold tracking-[0.12em]" data-testid="new-passcode">
                {groupDigits(newPasscode)}
              </div>
              <p className="mt-1 text-[12px] text-ink-2">Note it down: it&apos;s shown only now. You&apos;ll type it once per phone browser (or just scan the QR code below).</p>
              <button className="btn btn-sm mt-2" onClick={() => setNewPasscode("")}>
                I&apos;ve noted it
              </button>
            </div>
          ) : null}

          {/* 1. Addresses */}
          <div>
            <div className="section-title mb-2 flex items-center gap-1.5">
              <Wifi size={12} /> 1 · Your phone opens
            </div>
            {lan.length === 0 && !m.addresses.some((a) => a.kind.startsWith("tailscale")) ? (
              <p className="rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn-ink">This Mac isn&apos;t on a Wi-Fi or Ethernet network right now. Connect it, and the address appears here within a few seconds.</p>
            ) : (
              <ul className="divide-y divide-[var(--line)] rounded-lg border border-line">
                {m.addresses.map((a) => (
                  <li key={a.url} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[13px] font-medium">{a.url}</span>
                      <span className="block text-[11.5px] text-muted">
                        {a.label} · {HINT[a.kind] ?? ""}
                      </span>
                    </span>
                    <CopyButton text={a.url} />
                  </li>
                ))}
              </ul>
            )}
            {notListening.length ? <p className="mt-1.5 text-[11.5px] text-warn-ink">Couldn&apos;t open port {m.port} on {notListening.map((a) => a.url.replace(/^https?:\/\//, "")).join(", ")} yet - another app may be using it. Retrying automatically.</p> : null}
          </div>

          {/* 2. QR sign-in */}
          <div>
            <div className="section-title mb-2 flex items-center gap-1.5">
              <QrCode size={12} /> 2 · Sign in the phone
            </div>
            {pair && selected ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(selected.svg)}`} alt={`QR code that signs your phone in at ${selected.url}`} className="size-[188px] shrink-0 rounded-lg border border-line bg-white p-1" data-testid="pair-qr" />
                <div className="min-w-0 space-y-2 text-[12.5px]">
                  {pair.links.length > 1 ? (
                    <div className="flex flex-wrap gap-1" role="group" aria-label="Address in the QR code">
                      {pair.links.map((l) => (
                        <button key={l.kind + l.url} className={cn("btn btn-sm", l.kind === selected.kind && l.url === selected.url && "border-accent bg-accent-soft text-accent-ink")} onClick={() => setPairKind(l.kind)} aria-pressed={l.kind === selected.kind}>
                          {l.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <p>
                    Point your phone&apos;s camera at the code, open the link and tap <b>Sign in</b>. The phone must be on the same Wi-Fi{selected.kind.startsWith("tailscale") ? " (or on Tailscale)" : ""}.
                  </p>
                  <p className="text-muted">
                    Works once, for <Countdown until={pair.expiresAt} onExpire={expirePair} /> more. Opens {selected.url}
                  </p>
                  <button className="btn btn-sm" onClick={showQr} disabled={busy === "pair"}>
                    <RefreshCw size={13} /> New code
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn btn-primary" onClick={showQr} disabled={busy !== "" || m.addresses.length === 0}>
                  {busy === "pair" ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />} Show sign-in QR code
                </button>
                <span className="text-[12px] text-muted">or type the passcode on the phone&apos;s sign-in page.</span>
              </div>
            )}
          </div>

          {/* 3. Passcode */}
          <div>
            <div className="section-title mb-2 flex items-center gap-1.5">
              <KeyRound size={12} /> Passcode
            </div>
            <p className="mb-2 text-[12.5px] text-muted">{m.passcode.set ? `Set ${formatDateTime(m.passcode.setAt)}. Forgot it? Create a new one - phones already signed in stay signed in.` : "No passcode yet."}</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-sm" disabled={busy !== ""} onClick={() => call<MacStatus>("passcode", "/__crm/phone/passcode", {}, applyMac)}>
                {busy === "passcode" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} New passcode
              </button>
              <button className="btn btn-sm" onClick={() => setCustom((c) => ({ ...c, open: !c.open }))} aria-expanded={custom.open}>
                Choose my own…
              </button>
            </div>
            {custom.open ? (
              <form
                className="mt-2 space-y-2 rounded-lg border border-line p-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const r = await call<MacStatus>("custom", "/__crm/phone/passcode", { passcode: custom.value, signOutAll: custom.signOutAll }, applyMac);
                  if (r) {
                    setCustom({ open: false, value: "", signOutAll: false });
                    setNewPasscode("");
                    toast("Passcode saved");
                  }
                }}
              >
                <label className="block">
                  <span className="label">New passcode (at least 6 characters)</span>
                  <input className="input" value={custom.value} onChange={(e) => setCustom((c) => ({ ...c, value: e.target.value }))} autoComplete="off" spellCheck={false} minLength={6} maxLength={64} required />
                </label>
                <label className="flex items-center gap-2 text-[12.5px]">
                  <input type="checkbox" checked={custom.signOutAll} onChange={(e) => setCustom((c) => ({ ...c, signOutAll: e.target.checked }))} /> Also sign out phones that are signed in
                </label>
                <button className="btn btn-sm btn-primary" type="submit" disabled={busy !== ""}>
                  Save passcode
                </button>
              </form>
            ) : null}
            {m.security.lockedUntil || m.security.failedLastHour > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-warn-soft px-3 py-2 text-[12.5px] text-warn-ink">
                <AlertTriangle size={14} className="shrink-0" />
                <span className="flex-1">
                  {m.security.failedLastHour} wrong passcode attempt{m.security.failedLastHour === 1 ? "" : "s"} in the last hour.
                  {m.security.lockedUntil ? ` Sign-in is paused until ${new Date(m.security.lockedUntil).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}.` : ""} If that wasn&apos;t you, create a new passcode.
                </span>
                <button className="btn btn-sm" onClick={() => call<MacStatus>("unlock", "/__crm/phone/unlock", {}, applyMac)}>
                  Allow sign-in again
                </button>
              </div>
            ) : null}
          </div>

          {/* 4. Devices */}
          <div>
            <div className="section-title mb-2 flex items-center gap-1.5">
              <Smartphone size={12} /> Signed-in phones ({m.sessions.length})
            </div>
            {m.sessions.length === 0 ? (
              <p className="text-[12.5px] text-muted">None yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--line)] rounded-lg border border-line">
                {m.sessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]">
                    <span className="min-w-0">
                      <span className="block font-medium">{s.device}</span>
                      <span className="block text-[11.5px] text-muted">
                        {s.via} · {s.ip} · signed in {formatDateTime(s.createdAt)} · last used {relativeTime(s.lastSeenAt)}
                      </span>
                    </span>
                    <button className="btn btn-sm" onClick={() => call<MacStatus>("signout", "/__crm/phone/signout", { id: s.id }, applyMac)} disabled={busy !== ""}>
                      Sign out
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {m.sessions.length > 1 ? (
              <button className="btn btn-sm btn-danger mt-2" onClick={() => confirm("Sign out every phone?") && call<MacStatus>("signout", "/__crm/phone/signout", {}, applyMac)}>
                Sign out all phones
              </button>
            ) : null}
          </div>

          {m.tailscale.funnel ? (
            <p className="flex gap-2 rounded-lg bg-bad-soft px-3 py-2 text-[12.5px] text-bad-ink">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Tailscale Funnel is publishing this port to the internet. The CRM refuses those visitors, but please turn Funnel off (<code>tailscale funnel reset</code>).
            </p>
          ) : null}

          <details className="rounded-lg border border-line px-3 py-2 text-[12.5px]">
            <summary className="cursor-pointer font-medium">Tips: Home Screen, using it away from Wi-Fi, voice notes</summary>
            <ul className="mt-2 space-y-1.5 text-muted">
              <li>
                <b className="text-ink-2">Home Screen:</b> on iPhone open the address in Safari → Share → “Add to Home Screen”. On Android, Chrome → ⋮ → “Add to Home screen”. It opens like an app; sign in once more inside it.
              </li>
              <li>
                <b className="text-ink-2">Keep the Mac available:</b> the CRM runs on this Mac, so it must be awake with the CRM started. To stop it sleeping while plugged in: System Settings → Battery (or Energy) → Options → “Prevent automatic sleeping when the display is off”.
              </li>
              <li>
                <b className="text-ink-2">Away from your Wi-Fi:</b> install the free <b className="text-ink-2">Tailscale</b> app on this Mac and your phone and sign in to both with the same account. The Tailscale address then appears above and works over mobile data, privately - nothing is published on the internet.
              </li>
              <li>
                <b className="text-ink-2">Voice notes on the phone</b> need a secure (https) address. With Tailscale, run <code>tailscale serve --bg {m.port}</code> once in Terminal (it may ask you to enable HTTPS in the Tailscale admin page) and use the “Tailscale (HTTPS)” address. Calls, WhatsApp, email, notes and photos work on any address.
              </li>
              <li>
                <b className="text-ink-2">Lost phone?</b> Sign it out above and create a new passcode.
              </li>
            </ul>
          </details>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <span className="flex items-center gap-1.5 text-[12px] text-muted">
              <CheckCircle2 size={14} className="text-good" /> Phones must sign in · only your own network · this Mac never needs the passcode
            </span>
            <button className="btn btn-sm" disabled={busy !== ""} onClick={() => call<MacStatus>("enable", "/__crm/phone/enable", { enabled: false }, (r) => (applyMac(r), setPair(null), setNewPasscode("")))}>
              {busy === "enable" ? <Loader2 size={13} className="animate-spin" /> : null} Turn off phone access
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Header({ on }: { on: boolean }) {
  return (
    <div className="mb-1 flex items-center justify-between gap-2">
      <h2 className="card-title flex items-center gap-2">
        <Smartphone size={15} className="text-muted" /> Phone access
      </h2>
      <span className={cn("badge", on ? "border-transparent bg-good-soft text-good-ink" : "")}>{on ? "On" : "Off"}</span>
    </div>
  );
}
