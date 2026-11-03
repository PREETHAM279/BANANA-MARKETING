"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Circle, Database, Download, FileJson, FileSpreadsheet, Globe, HardDriveDownload, Loader2, RefreshCw, ShieldCheck, Star, UserRound } from "lucide-react";
import { api } from "@/lib/client";
import { formatDateTime } from "@/lib/format";
import { Field } from "./ui/primitives";
import { useToast } from "./ui/toast";

type Backup = { name: string; size: number; createdAt: string };
type Props = {
  settings: Record<string, string>;
  integrations: { googlePlaces: boolean; smtp: boolean; smtpFrom: string };
  backups: Backup[];
  backupFolder: string;
  dataFolder: string;
  enrichable: { id: string; name: string }[];
  allIds: { id: string; name: string }[];
  researchImportedAt: string | null;
};

function kb(n: number) {
  return n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`;
}

export function SettingsClient({ settings: initial, integrations, backups: initialBackups, backupFolder, dataFolder, enrichable, allIds, researchImportedAt }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [backups, setBackups] = useState(initialBackups);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number; ok: number; failed: number } | null>(null);

  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/settings`, { method: "PUT", body: s });
      toast("Settings saved - messages now use your details");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  const backup = async () => {
    setBusy("backup");
    try {
      const r = await api<{ backup: Backup; backups: Backup[] }>(`/api/backup`, { method: "POST" });
      setBackups(r.backups);
      toast(`Backup created: ${r.backup.name}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Backup failed", "error");
    } finally {
      setBusy("");
    }
  };

  const reimport = async () => {
    if (!confirm("Refresh research data from data/research? Your statuses, notes, activities and follow-ups are kept.")) return;
    setBusy("reimport");
    try {
      const r = await api<{ output: string }>(`/api/research/reimport`, { method: "POST" });
      toast(r.output || "Research refreshed");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Re-import failed", "error");
    } finally {
      setBusy("");
    }
  };

  const bulk = async (kind: "site" | "google") => {
    const list = kind === "site" ? enrichable : allIds;
    if (!confirm(kind === "site" ? `Read ${list.length} official websites now? Takes a few minutes; you can keep working.` : `Look up ${list.length} businesses on Google Places? This uses your Google API quota (about ${list.length} requests).`)) return;
    setBusy(kind);
    setProgress({ done: 0, total: list.length, ok: 0, failed: 0 });
    let ok = 0;
    let failed = 0;
    for (let i = 0; i < list.length; i++) {
      try {
        await api(`/api/businesses/${list[i].id}/${kind === "site" ? "enrich" : "google"}`, { method: "POST" });
        ok++;
      } catch {
        failed++;
      }
      setProgress({ done: i + 1, total: list.length, ok, failed });
    }
    setBusy("");
    toast(`${kind === "site" ? "Websites" : "Google"} finished: ${ok} updated, ${failed} could not be read`, failed ? "info" : "ok");
    router.refresh();
  };

  const input = (key: string, label: string, placeholder = "", hint?: string, type = "text") => (
    <Field label={label} hint={hint}>
      <input className="input" type={type} value={s[key] ?? ""} placeholder={placeholder} onChange={(e) => setS({ ...s, [key]: e.target.value })} />
    </Field>
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <section className="card p-5">
        <h2 className="card-title mb-1 flex items-center gap-2">
          <UserRound size={15} className="text-muted" /> Your details (used in calls, WhatsApp and emails)
        </h2>
        <p className="mb-4 text-[12.5px] text-muted">Openers and messages fill in your name and company from here.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {input("yourName", "Your name", "e.g. Preetham")}
          {input("yourCompany", "Your company", "e.g. Banana Marketing")}
          {input("yourRole", "Your role", "Business Development")}
          {input("yourPhone", "Your phone", "+91 9xxxx xxxxx")}
          {input("yourEmail", "Your email", "you@company.com", undefined, "email")}
          {input("dailyCallTarget", "Daily call target", "40", undefined, "number")}
          {input("productSocial", "Product A name (social media)", "our Social Media Management app")}
          {input("productAttendance", "Product B name (attendance)", "our Employee Attendance app")}
          <div className="sm:col-span-2">{input("demoLink", "Demo / brochure link (optional)", "https://…", "Added to WhatsApp and email drafts when set.")}</div>
          <div className="sm:col-span-2">
            <Field label="Email signature (optional)" hint="Leave empty to build it from your name, role, company, phone and email.">
              <textarea className="textarea" value={s.signature ?? ""} onChange={(e) => setS({ ...s, signature: e.target.value })} />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save details"}
          </button>
        </div>
      </section>

      <div className="space-y-4">
        <section className="card p-5">
          <h2 className="card-title mb-1 flex items-center gap-2">
            <Database size={15} className="text-muted" /> Backups & export
          </h2>
          <p className="mb-3 text-[12.5px] text-muted">
            Your CRM lives in one file: <code className="text-ink-2">{dataFolder}/crm.db</code>. Backups are complete copies you can restore at any time.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={backup} disabled={busy === "backup"}>
              {busy === "backup" ? <Loader2 size={14} className="animate-spin" /> : <HardDriveDownload size={14} />} Back up now
            </button>
            <a className="btn" href="/api/export?format=xlsx">
              <FileSpreadsheet size={14} /> Excel (.xlsx)
            </a>
            <a className="btn" href="/api/export?format=csv">
              <Download size={14} /> CSV
            </a>
            <a className="btn" href="/api/export?format=json">
              <FileJson size={14} /> JSON (everything)
            </a>
          </div>
          <div className="mt-4">
            <div className="section-title mb-1.5">Backups in {backupFolder}</div>
            {backups.length === 0 ? (
              <p className="text-[12.5px] text-muted">No backups yet. The start script also makes one automatically each day you launch the CRM.</p>
            ) : (
              <ul className="max-h-[220px] divide-y divide-[var(--line)] overflow-y-auto rounded-lg border border-line">
                {backups.map((b) => (
                  <li key={b.name} className="flex items-center justify-between gap-2 px-3 py-2 text-[12.5px]">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{b.name}</span>
                      <span className="text-[11.5px] text-muted">
                        {formatDateTime(b.createdAt)} · {kb(b.size)}
                      </span>
                    </span>
                    <a className="btn btn-sm" href={`/api/backup/${encodeURIComponent(b.name)}`}>
                      <Download size={13} /> Download
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11.5px] text-muted">To restore: quit the CRM (stop-crm.command), then run restore-backup.command and pick a backup. Your current database is saved first.</p>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="card-title mb-1 flex items-center gap-2">
            <Globe size={15} className="text-muted" /> Research data & enrichment
          </h2>
          <p className="mb-3 text-[12.5px] text-muted">
            100 businesses researched on 3 Nov 2026 from public sources (each profile lists its sources).
            {researchImportedAt ? ` Last imported ${formatDateTime(researchImportedAt)}.` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={() => bulk("site")} disabled={busy !== ""} title="Fetch photos, emails, phones and social links from each official website">
              {busy === "site" ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />} Check all official websites ({enrichable.length})
            </button>
            <button className="btn" onClick={() => bulk("google")} disabled={busy !== "" || !integrations.googlePlaces} title={integrations.googlePlaces ? "Ratings, review counts, Maps links and photos" : "Needs GOOGLE_PLACES_API_KEY"}>
              {busy === "google" ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />} Fetch Google ratings & photos
            </button>
            <button className="btn" onClick={reimport} disabled={busy !== ""}>
              {busy === "reimport" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Re-import research files
            </button>
          </div>
          {progress ? (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[12px] text-muted">
                <span>
                  {progress.done}/{progress.total} · {progress.ok} updated · {progress.failed} failed
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
            </div>
          ) : null}
          <p className="mt-3 text-[11.5px] text-muted">Website checks run from your Mac and only read the public home and contact pages. Results are labelled “auto-extracted - verify”.</p>
        </section>

        <section className="card p-5">
          <h2 className="card-title mb-3 flex items-center gap-2">
            <ShieldCheck size={15} className="text-muted" /> Integrations & privacy
          </h2>
          <ul className="space-y-3 text-[12.5px]">
            <li className="flex gap-2">
              {integrations.googlePlaces ? <CheckCircle2 size={16} className="shrink-0 text-good" /> : <Circle size={16} className="shrink-0 text-muted" />}
              <div>
                <p className="font-medium">Google Places (ratings, reviews, photos) - {integrations.googlePlaces ? "connected" : "not configured"}</p>
                <p className="text-muted">
                  Create an API key in Google Cloud with “Places API (New)” enabled, then add <code>GOOGLE_PLACES_API_KEY=…</code> to <code>.env.local</code> and restart. Google bills per request beyond its monthly free usage - 100 lookups is a small amount.
                </p>
              </div>
            </li>
            <li className="flex gap-2">
              {integrations.smtp ? <CheckCircle2 size={16} className="shrink-0 text-good" /> : <Circle size={16} className="shrink-0 text-muted" />}
              <div>
                <p className="font-medium">Email sending (SMTP) - {integrations.smtp ? `connected as ${integrations.smtpFrom}` : "not configured"}</p>
                <p className="text-muted">
                  For Gmail: turn on 2-step verification, create an App Password, then set <code>SMTP_HOST=smtp.gmail.com</code>, <code>SMTP_PORT=587</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code> (the app password) and <code>SMTP_FROM</code> in <code>.env.local</code>. Without it, the Mail app / Gmail draft buttons still work.
                </p>
              </div>
            </li>
            <li className="flex gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-good" />
              <div>
                <p className="font-medium">Private by design</p>
                <p className="text-muted">The website only listens on this Mac (127.0.0.1) and rejects requests from other sites. Keys live in .env.local and never reach the browser. Nothing is uploaded to any cloud service.</p>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
