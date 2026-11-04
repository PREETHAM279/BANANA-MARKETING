"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  Lightbulb,
  Loader2,
  Mail,
  MapPin,
  MessageSquareText,
  PhoneCall,
  Plus,
  ShieldCheck,
  Star,
  Target,
  Users,
} from "lucide-react";
import { PRODUCT_LABEL, STATUSES } from "@/lib/constants";
import { cn, dueLabel, formatDateTime, formatDay, hostOf, mapsEmbedUrl, mapsSearchUrl, telHref } from "@/lib/format";
import { api, getLocal } from "@/lib/client";
import { personalize } from "@/lib/templates";
import type { ActivityItem, LeadDetail, LeadListItem, NoteItem, PhotoItem, RecordingItem } from "@/lib/types";
import { CopyButton, EmailDialog, LogActivityDialog, PhoneActions, WhatsAppDialog, type LoggedResult, type Settings } from "../comms";
import { DIR_QUERY_KEY } from "../Directory";
import { Badge, Field, FieldGroup, FitDots, InterestBadge, NotVerified, StatusBadge } from "../ui/primitives";
import { FacebookIcon, InstagramIcon, LinkedinIcon, WhatsappIcon, YoutubeIcon } from "../ui/icons";
import { useToast } from "../ui/toast";
import { Notes, Photos, Recorder, TagsInput, Timeline, type GalleryImage } from "./widgets";

type Integrations = { googlePlaces: boolean; smtp: boolean };

function Section({ id, title, icon, children, right }: { id?: string; title: string; icon?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-4">
      <div className="card-header">
        <h2 className="card-title flex items-center gap-2">
          {icon ? <span className="text-muted">{icon}</span> : null}
          {title}
        </h2>
        {right}
      </div>
      <div className="px-4 pb-4 text-[13px] leading-relaxed">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 border-b border-line py-2 last:border-0">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function SourceLink({ url, label = "source" }: { url?: string | null; label?: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-[11.5px] text-accent-ink hover:underline" title={url}>
      {label}
      <ExternalLink size={10} />
    </a>
  );
}

function SaveState({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  return (
    <span className={cn("text-[11.5px]", state === "error" ? "text-bad-ink" : "text-muted")}>
      {state === "saving" ? "Saving…" : state === "saved" ? "All changes saved" : "Save failed"}
    </span>
  );
}

export function ProfileClient({ initial, settings, integrations, prevId, nextId }: { initial: LeadDetail; settings: Settings; integrations: Integrations; prevId: string | null; nextId: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [lead, setLead] = useState<LeadDetail>(initial);
  const [activities, setActivities] = useState<ActivityItem[]>(initial.activities);
  const [notes, setNotes] = useState<NoteItem[]>(initial.notes);
  const [photos, setPhotos] = useState<PhotoItem[]>(initial.photos);
  const [recordings, setRecordings] = useState<RecordingItem[]>(initial.recordings);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [dialog, setDialog] = useState<null | { kind: "log"; type: string; startedAt?: number; target?: string } | { kind: "wa"; number?: string } | { kind: "email" }>(null);
  const [busy, setBusy] = useState<"" | "site" | "google">("");
  const [backHref, setBackHref] = useState("/leads");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const saved = getLocal<string>(DIR_QUERY_KEY, "");
    setBackHref(saved ? `/leads?${saved}` : "/leads");
  }, []);

  useEffect(() => {
    setLead(initial);
    setActivities(initial.activities);
    setNotes(initial.notes);
    setPhotos(initial.photos);
    setRecordings(initial.recordings);
  }, [initial]);

  // Keyboard: [ and ] move to previous / next lead by priority.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.key === "[" && prevId) router.push(`/leads/${prevId}`);
      if (e.key === "]" && nextId) router.push(`/leads/${nextId}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevId, nextId, router]);

  const mergeSummary = useCallback((s: LeadListItem | null) => {
    if (!s) return;
    setLead((l) => ({ ...l, ...s }));
  }, []);

  const patch = useCallback(
    async (data: Record<string, unknown>) => {
      setSaveState("saving");
      try {
        const s = await api<LeadListItem>(`/api/businesses/${lead.id}`, { method: "PATCH", body: data });
        mergeSummary(s);
        setSaveState("saved");
        if ("status" in data || "followUpDate" in data || "meetingAt" in data || "doNotContact" in data) {
          const acts = await api<ActivityItem[]>(`/api/businesses/${lead.id}/activities`);
          setActivities(acts);
          router.refresh();
        }
      } catch (e) {
        setSaveState("error");
        toast(e instanceof Error ? e.message : "Could not save", "error");
      }
    },
    [lead.id, mergeSummary, router, toast],
  );

  const debounced = (key: string, data: Record<string, unknown>, ms = 700) => {
    clearTimeout(timers.current[key]);
    setSaveState("saving");
    timers.current[key] = setTimeout(() => patch(data), ms);
  };

  const onLogged = (r: LoggedResult) => {
    setActivities((a) => [r.activity, ...a]);
    mergeSummary(r.lead);
    api<ActivityItem[]>(`/api/businesses/${lead.id}/activities`).then(setActivities).catch(() => {});
    router.refresh();
  };

  const enrichSite = async () => {
    setBusy("site");
    try {
      const d = await api<LeadDetail>(`/api/businesses/${lead.id}/enrich`, { method: "POST" });
      setLead(d);
      setActivities(d.activities);
      toast("Official website checked");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not reach the website", "error");
    } finally {
      setBusy("");
    }
  };
  const enrichGoogle = async () => {
    setBusy("google");
    try {
      const d = await api<LeadDetail>(`/api/businesses/${lead.id}/google`, { method: "POST" });
      setLead(d);
      setActivities(d.activities);
      toast("Google data updated");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Google lookup failed", "error");
    } finally {
      setBusy("");
    }
  };

  const gallery: GalleryImage[] = useMemo(() => {
    const imgs: GalleryImage[] = photos.map((p) => ({ url: p.url, source: p.source || "Uploaded by you", id: p.id }));
    if (lead.siteData?.image) imgs.push({ url: lead.siteData.image, source: "Official website image (may be a logo)" });
    else if (initial.photoSource && initial.photoUrl && !initial.photoUrl.startsWith("/api/")) imgs.push({ url: initial.photoUrl, source: initial.photoSource });
    lead.googleData?.photos?.forEach((g) =>
      imgs.push({ url: `/api/google-photo?name=${encodeURIComponent(g.name)}`, source: "Google Maps photo", attribution: g.attributions.map((a) => a.displayName).filter(Boolean).join(", ") }),
    );
    return imgs;
  }, [photos, lead.siteData, lead.googleData, initial.photoSource, initial.photoUrl]);

  const primaryPhone = lead.phones.find((p) => p.type === "mobile") ?? lead.phones[0];
  const owners = lead.people.filter((p) => p.type === "owner");
  const managers = lead.people.filter((p) => p.type !== "owner");
  const due = dueLabel(lead.followUpDate);
  const opener = personalize(lead.opener, settings);
  const pitch = personalize(lead.pitch, settings);
  const extra = { followUpDate: lead.followUpDate, meetingAt: lead.meetingAt };

  const social: { label: string; url: string | null; icon: ReactNode }[] = [
    { label: "Instagram", url: lead.instagram || lead.siteData?.socials?.instagram || null, icon: <InstagramIcon /> },
    { label: "Facebook", url: lead.facebook || lead.siteData?.socials?.facebook || null, icon: <FacebookIcon /> },
    { label: "LinkedIn", url: lead.linkedin || lead.siteData?.socials?.linkedin || null, icon: <LinkedinIcon /> },
    { label: "YouTube", url: lead.youtube || lead.siteData?.socials?.youtube || null, icon: <YoutubeIcon /> },
  ];

  return (
    <div>
      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={backHref} className="btn btn-sm">
            <ArrowLeft size={14} /> Directory
          </Link>
          <span className="hidden text-[12px] text-muted sm:inline">Filters are kept</span>
        </div>
        <div className="flex items-center gap-1.5">
          <SaveState state={saveState} />
          <Link href={prevId ? `/leads/${prevId}` : "#"} aria-disabled={!prevId} className={cn("btn btn-sm", !prevId && "pointer-events-none opacity-40")} title="Previous lead by priority ( [ )">
            <ChevronLeft size={14} /> Prev
          </Link>
          <Link href={nextId ? `/leads/${nextId}` : "#"} aria-disabled={!nextId} className={cn("btn btn-sm", !nextId && "pointer-events-none opacity-40")} title="Next lead by priority ( ] )">
            Next <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 [grid-template-areas:'left'_'right'_'middle'] lg:grid-cols-[minmax(0,1fr)_340px] lg:[grid-template-areas:'left_right'_'middle_right'] 2xl:grid-cols-[290px_minmax(0,1fr)_350px] 2xl:[grid-template-areas:'left_middle_right']">
        {/* LEFT: identity, photos, location, links */}
        <div className="grid content-start gap-4 [grid-area:left] md:grid-cols-2 2xl:grid-cols-1">
          <div className="card overflow-hidden">
            <Photos businessId={lead.id} name={lead.name} images={gallery} onUploaded={(p) => setPhotos((x) => [...x, p])} onDeleted={(id) => setPhotos((x) => x.filter((p) => p.id !== id))} />
            <div className="space-y-2 px-4 pb-4">
              <div className="flex items-start justify-between gap-2">
                <h1 className="text-[19px] font-semibold leading-tight tracking-[-0.01em]">{lead.name}</h1>
                <span className="badge shrink-0 font-semibold" title="Priority rank (1 = call first)">
                  #{lead.priorityRank}
                </span>
              </div>
              <p className="text-[12.5px] text-muted">
                {lead.category} · {lead.subcategory}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <InterestBadge level={lead.interestLevel} />
                <Badge tone="accent">{PRODUCT_LABEL[lead.recommendedProduct]}</Badge>
                <StatusBadge status={lead.status} />
                {lead.doNotContact ? <Badge tone="bad">Do not contact</Badge> : null}
              </div>
              {/* Phones / small screens: the main actions right under the name (the full Contact card is further down). */}
              <div className="pt-1.5 lg:hidden" data-testid="quick-actions">
                <div className="grid grid-cols-4 gap-1.5">
                  {primaryPhone ? (
                    <a href={telHref(primaryPhone.number)} onClick={() => setDialog({ kind: "log", type: "CALL", startedAt: Date.now(), target: primaryPhone.number })} className="btn btn-primary h-auto flex-col gap-0.5 px-1 py-2 text-[12px]">
                      <PhoneCall size={17} /> Call
                    </a>
                  ) : (
                    <a href={lead.googleMapsUri || mapsSearchUrl(lead.mapsQuery)} target="_blank" rel="noopener noreferrer" className="btn h-auto flex-col gap-0.5 px-1 py-2 text-[12px]">
                      <MapPin size={17} /> Maps
                    </a>
                  )}
                  <button className="btn h-auto flex-col gap-0.5 px-1 py-2 text-[12px]" onClick={() => setDialog({ kind: "wa", number: primaryPhone?.type === "mobile" ? primaryPhone.number : undefined })}>
                    <WhatsappIcon width={17} height={17} /> WhatsApp
                  </button>
                  <button className="btn h-auto flex-col gap-0.5 px-1 py-2 text-[12px]" onClick={() => setDialog({ kind: "email" })}>
                    <Mail size={17} /> Email
                  </button>
                  <button className="btn h-auto flex-col gap-0.5 px-1 py-2 text-[12px]" onClick={() => setDialog({ kind: "log", type: "CALL" })}>
                    <Plus size={17} /> Log
                  </button>
                </div>
                <p className="mt-1.5 truncate text-[11.5px] text-muted">
                  {primaryPhone ? (
                    <>
                      Calls <span className="tabular text-ink-2">{primaryPhone.number}</span> · {primaryPhone.type === "landline" ? "Landline" : "Mobile"}
                      {lead.phones.length > 1 ? ` · ${lead.phones.length - 1} more below` : ""}
                    </>
                  ) : (
                    "No public phone verified - find it on Google Maps."
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="section-title mb-2 flex items-center gap-1.5">
              <MapPin size={12} /> Address & map
            </div>
            <p className="text-[13px]">{lead.address}</p>
            <p className="mt-1 text-[12px] text-muted">
              {lead.locality} · {lead.zone}
            </p>
            <div className="mt-2 flex gap-1.5">
              <CopyButton text={lead.address} label="Copy" />
              <a className="btn btn-sm" href={lead.googleMapsUri || mapsSearchUrl(lead.mapsQuery)} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={13} /> Google Maps
              </a>
            </div>
            <div className="mt-3 overflow-hidden rounded-lg border border-line">
              <iframe title={`Map of ${lead.name}`} src={mapsEmbedUrl(lead.mapsQuery)} className="h-[190px] w-full" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
            </div>
            <p className="mt-1.5 text-[11px] text-muted">Map shows Google&apos;s best match for the name and address - confirm the pin before visiting.</p>
          </div>

          <div className="card p-4 md:col-span-2 2xl:col-span-1">
            <div className="section-title mb-2 flex items-center gap-1.5">
              <Globe size={12} /> Website & social
            </div>
            <ul className="space-y-2 text-[13px]">
              <li className="flex items-start gap-2">
                <Globe size={15} className="mt-0.5 shrink-0 text-muted" />
                {lead.website ? (
                  <span className="min-w-0">
                    <a href={lead.website} target="_blank" rel="noopener noreferrer" className="link break-all">
                      {hostOf(lead.website)}
                    </a>
                    {lead.websiteNote ? <span className="block text-[11.5px] text-muted">{lead.websiteNote}</span> : null}
                  </span>
                ) : (
                  <NotVerified>Official website not found</NotVerified>
                )}
              </li>
              {social.map((s) => (
                <li key={s.label} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-muted">{s.icon}</span>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="link min-w-0 break-all">
                      {s.label}
                      {s.label === "Instagram" && lead.instagramNote ? <span className="block text-[11.5px] text-muted">{lead.instagramNote}</span> : null}
                    </a>
                  ) : (
                    <span>
                      <span className="text-ink-2">{s.label}: </span>
                      <NotVerified />
                    </span>
                  )}
                </li>
              ))}
              <li className="flex items-start gap-2">
                <MapPin size={15} className="mt-0.5 shrink-0 text-muted" />
                <a href={lead.googleMapsUri || mapsSearchUrl(lead.mapsQuery)} target="_blank" rel="noopener noreferrer" className="link">
                  Google Business Profile
                </a>
              </li>
            </ul>
            <div className="mt-3 rounded-lg bg-surface-2 p-2.5 text-[12.5px]">
              <div className="flex items-center gap-1.5 font-medium">
                <Star size={13} className="text-muted" /> Google rating
              </div>
              {lead.googleRating != null ? (
                <p className="mt-0.5">
                  <span className="font-semibold">{lead.googleRating.toFixed(1)}★</span> from {lead.googleReviews?.toLocaleString("en-IN") ?? 0} Google reviews
                  <span className="block text-[11px] text-muted">Google Places API · fetched {formatDateTime(lead.googleFetchedAt)}</span>
                </p>
              ) : (
                <p className="mt-0.5 text-muted">
                  <span className="italic">Not publicly verified.</span> {lead.ratingsNote ? <span className="block not-italic">{lead.ratingsNote}</span> : null}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button className="btn btn-sm" onClick={enrichGoogle} disabled={busy !== "" || !integrations.googlePlaces} title={integrations.googlePlaces ? "Fetch rating, reviews and photos from Google Places" : "Add GOOGLE_PLACES_API_KEY in .env.local to enable"}>
                  {busy === "google" ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />} {integrations.googlePlaces ? "Fetch from Google" : "Google (needs API key)"}
                </button>
                <button className="btn btn-sm" onClick={enrichSite} disabled={busy !== "" || !lead.website} title={lead.website ? "Read the official website for photos, emails, phones and social links" : "No official website on file"}>
                  {busy === "site" ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />} Check website
                </button>
              </div>
            </div>
            {lead.siteData ? (
              <div className="mt-3 rounded-lg border border-line p-2.5 text-[12px]">
                <div className="mb-1 font-medium">Found on official website</div>
                {lead.siteData.error ? (
                  <p className="text-bad-ink">Could not read the site: {lead.siteData.error}</p>
                ) : (
                  <>
                    <p className="text-muted">Auto-extracted {formatDateTime(lead.siteData.fetchedAt)} - verify before use.</p>
                    {lead.siteData.emails.length ? <p className="mt-1 break-all">Emails: {lead.siteData.emails.join(", ")}</p> : null}
                    {lead.siteData.phones.length ? <p className="mt-1">Phones: {lead.siteData.phones.join(", ")}</p> : null}
                    {!lead.siteData.emails.length && !lead.siteData.phones.length ? <p className="mt-1 text-muted">No emails or phone numbers found on the page.</p> : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* MIDDLE: intelligence */}
        <div className="min-w-0 space-y-4 [grid-area:middle]">
          <Section title="Business overview" icon={<Briefcase size={14} />} right={<span className="text-[11.5px] text-muted">Researched {formatDay(lead.researchDate)}</span>}>
            <p>{lead.description}</p>
            <dl className="mt-3">
              <Row label="Products & services">{lead.offerings || <NotVerified />}</Row>
              <Row label="Branches">
                {lead.branches || <NotVerified />}
                {lead.branchCount ? <span className="ml-1 text-muted">({lead.branchCount} counted)</span> : null}
              </Row>
              <Row label="Key facts">
                <ul className="list-disc space-y-1 pl-4">
                  {lead.facts.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </Row>
            </dl>
          </Section>

          <Section title="Owner & decision-makers" icon={<Users size={14} />}>
            <dl>
              <Row label="Owner / founder">
                {owners.length ? (
                  <ul className="space-y-1">
                    {owners.map((p) => (
                      <li key={p.name}>
                        <span className="font-medium">{p.name}</span> <span className="text-muted">- {p.role}</span>
                        <SourceLink url={p.source} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <NotVerified />
                )}
              </Row>
              <Row label="Manager / other">
                {managers.length ? (
                  <ul className="space-y-1">
                    {managers.map((p) => (
                      <li key={p.name}>
                        <span className="font-medium">{p.name}</span> <span className="text-muted">- {p.role}</span>
                        <SourceLink url={p.source} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <NotVerified />
                )}
              </Row>
              <Row label="Business phone">
                {lead.phones.length ? (
                  <ul className="space-y-1">
                    {lead.phones.map((p) => (
                      <li key={p.number}>
                        <span className="tabular font-medium">{p.number}</span> <span className="text-muted">({p.type}) - {p.label}</span>
                        <SourceLink url={p.source} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <NotVerified />
                )}
              </Row>
              <Row label="Decision-maker phone">{lead.decisionMakerPhone || <NotVerified>Not publicly verified - ask for a direct line on the call</NotVerified>}</Row>
              <Row label="Official email">
                {lead.emails.length ? (
                  <ul className="space-y-1">
                    {lead.emails.map((e) => (
                      <li key={e.email} className="break-all">
                        {e.email} <span className="text-muted">- {e.label}</span>
                        <SourceLink url={e.source} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <NotVerified />
                )}
              </Row>
              <Row label="Decision-maker email">{lead.decisionMakerEmail || <NotVerified />}</Row>
              <Row label="LinkedIn">
                {lead.linkedin ? (
                  <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="link">
                    Company page
                  </a>
                ) : (
                  <NotVerified />
                )}
                {lead.decisionMakerLinkedin ? null : <span className="block text-[11.5px] text-muted">Personal LinkedIn profiles were not verified.</span>}
              </Row>
            </dl>
          </Section>

          <Section title="Employees & operations" icon={<Users size={14} />}>
            <dl>
              <Row label="Verified headcount">
                {lead.employeeCountVerified ? (
                  <>
                    {lead.employeeCountVerified}
                    <SourceLink url={lead.employeeCountSource} />
                  </>
                ) : (
                  <NotVerified />
                )}
              </Row>
              <Row label="Estimated headcount">
                {lead.employeeEstimate ? (
                  <>
                    <Badge tone="warn" className="mr-1.5">
                      Estimate
                    </Badge>
                    ~{lead.employeeEstimate} people
                    <span className="block text-[12px] text-muted">{lead.employeeEstimateBasis}</span>
                  </>
                ) : (
                  <NotVerified />
                )}
              </Row>
              <Row label="Locations">{lead.branchCount ? `${lead.branchCount}` : <NotVerified />}</Row>
              <Row label="Management">{lead.managementStructure}</Row>
              <Row label="Attendance need">
                <FitDots level={lead.attendanceFit} label={lead.attendanceFit} />
                <span className="block text-[12.5px] text-ink-2">{lead.attendanceFitReason}</span>
              </Row>
              <Row label="Social media need">
                <FitDots level={lead.socialFit} label={lead.socialFit} />
                <span className="block text-[12.5px] text-ink-2">{lead.socialFitReason}</span>
              </Row>
            </dl>
            <div className="mt-3">
              <div className="section-title mb-1.5">Likely operational problems · validate on the call</div>
              <ul className="list-disc space-y-1 pl-4 text-ink-2">
                {lead.operationalProblems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </Section>

          <Section title="Social media analysis" icon={<MessageSquareText size={14} />}>
            <p className="text-ink-2">{lead.socialPresence}</p>
            <div className="section-title mb-1.5 mt-3">Weaknesses & opportunities</div>
            <ul className="list-disc space-y-1 pl-4 text-ink-2">
              {lead.socialWeaknesses.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Section>

          <Section title="Sales opportunity" icon={<Target size={14} />}>
            <dl>
              <Row label="Why a prospect">{lead.whyProspect}</Row>
              <Row label="Best product">
                <Badge tone="accent" className="mb-1">
                  {PRODUCT_LABEL[lead.recommendedProduct]}
                </Badge>
                <span className="block text-ink-2">{lead.productReason}</span>
              </Row>
              <Row label="Interest level">
                <InterestBadge level={lead.interestLevel} />
                <span className="mt-1 block text-ink-2">{lead.interestReason}</span>
              </Row>
              <Row label="Best time to call">{lead.bestTimeToCall}</Row>
            </dl>
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-line p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="section-title">Conversation opener</span>
                  <CopyButton text={opener} />
                </div>
                <p className="text-[13.5px]">{opener}</p>
              </div>
              <div className="rounded-lg border border-line p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="section-title">Customised pitch</span>
                  <CopyButton text={pitch} />
                </div>
                <p>{pitch}</p>
              </div>
              <div className="rounded-lg border border-line p-3">
                <div className="section-title mb-1.5">Best way to approach</div>
                <ol className="list-decimal space-y-1 pl-4 text-ink-2">
                  {lead.approach.split("\n").map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-line p-3">
                  <div className="section-title mb-1.5 flex items-center gap-1">
                    <Lightbulb size={12} /> Discovery questions
                  </div>
                  <ul className="list-disc space-y-1 pl-4 text-ink-2">
                    {lead.discoveryQuestions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <div className="section-title mb-1.5">Objection handling</div>
                  <ul className="space-y-2">
                    {lead.objections.map((o) => (
                      <li key={o.q}>
                        <span className="block font-medium">“{o.q}”</span>
                        <span className="text-ink-2">{o.a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Sources & verification" icon={<ShieldCheck size={14} />} right={<Badge tone={lead.confidence === "High" ? "good" : "warn"}>{lead.confidence} confidence</Badge>}>
            <p className="flex items-start gap-1.5 text-ink-2">
              <BadgeCheck size={14} className="mt-0.5 shrink-0 text-muted" /> {lead.verification}
            </p>
            <p className="mt-2 flex items-start gap-1.5 text-[12px] text-muted">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> Research used public web sources on {formatDay(lead.researchDate)}. Phone numbers from directories can go stale - confirm on the first call. Estimates are labelled.
            </p>
            <ul className="mt-3 space-y-1">
              {lead.sources.map((s) => (
                <li key={s.url} className="flex items-start gap-1.5 text-[12.5px]">
                  <ExternalLink size={12} className="mt-1 shrink-0 text-muted" />
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="link min-w-0 break-words">
                    {s.label}
                  </a>
                  <span className="shrink-0 text-[11px] text-muted">{hostOf(s.url)}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        {/* RIGHT: actions */}
        <div className="min-w-0 [grid-area:right]">
          <div className="space-y-4">
            <div className="card p-4">
              <div className="section-title mb-2.5">Contact</div>
              <PhoneActions lead={lead} onCall={(n) => setDialog({ kind: "log", type: "CALL", startedAt: Date.now(), target: n })} onWhatsApp={(n) => setDialog({ kind: "wa", number: n })} />
              {!lead.phones.length ? (
                <a className="link mt-1 inline-flex items-center gap-1 text-[12.5px]" href={lead.googleMapsUri || mapsSearchUrl(lead.mapsQuery)} target="_blank" rel="noopener noreferrer">
                  Find the number on Google Maps <ExternalLink size={11} />
                </a>
              ) : null}
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                <button className="btn btn-sm" onClick={() => setDialog({ kind: "wa" })}>
                  <WhatsappIcon width={14} height={14} /> WhatsApp
                </button>
                <button className="btn btn-sm" onClick={() => setDialog({ kind: "email" })}>
                  <Mail size={14} /> Email
                </button>
                <button className="btn btn-sm" onClick={() => setDialog({ kind: "log", type: "CALL" })}>
                  <Plus size={14} /> Log
                </button>
              </div>
              <p className="mt-2 text-[11.5px] text-muted">“Call” dials from your phone (on the Mac: through your iPhone via Continuity, or FaceTime) and starts a timer. Nothing is marked as done until you record the outcome.</p>
            </div>

            <div className="card space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div className="section-title">Lead management</div>
                <SaveState state={saveState} />
              </div>
              <Field label="Lead status">
                <select className="select" value={lead.status} onChange={(e) => (setLead((l) => ({ ...l, status: e.target.value })), patch({ status: e.target.value }))}>
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Follow-up date" hint={due ? <span className={due.tone === "bad" ? "text-bad-ink" : due.tone === "warn" ? "text-warn-ink" : ""}>{due.text}</span> : undefined}>
                  <input className="input" type="date" value={lead.followUpDate ?? ""} onChange={(e) => (setLead((l) => ({ ...l, followUpDate: e.target.value || null })), patch({ followUpDate: e.target.value || null }))} />
                </Field>
                <Field label="Deal value (₹)">
                  <input
                    className="input tabular"
                    type="number"
                    min={0}
                    step={1000}
                    value={lead.dealValue ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      setLead((l) => ({ ...l, dealValue: v }));
                      debounced("dealValue", { dealValue: v });
                    }}
                    placeholder="e.g. 60000"
                  />
                </Field>
              </div>
              <Field label="Follow-up note">
                <input
                  className="input"
                  value={lead.followUpNote}
                  onChange={(e) => {
                    setLead((l) => ({ ...l, followUpNote: e.target.value }));
                    debounced("followUpNote", { followUpNote: e.target.value });
                  }}
                  placeholder="What to do on the follow-up"
                />
              </Field>
              <Field label="Next action">
                <input
                  className="input"
                  value={lead.nextAction}
                  onChange={(e) => {
                    setLead((l) => ({ ...l, nextAction: e.target.value }));
                    debounced("nextAction", { nextAction: e.target.value });
                  }}
                  placeholder="e.g. Send pricing for 8 outlets"
                />
              </Field>
              <Field label="Meeting / demo">
                <input className="input" type="datetime-local" value={lead.meetingAt ?? ""} onChange={(e) => (setLead((l) => ({ ...l, meetingAt: e.target.value || null })), patch({ meetingAt: e.target.value || null }))} />
              </Field>
              <FieldGroup label="Tags">
                <TagsInput tags={lead.tags} onChange={(t) => (setLead((l) => ({ ...l, tags: t })), patch({ tags: t }))} />
              </FieldGroup>
              <label className="flex items-center gap-2 text-[12.5px]">
                <input type="checkbox" checked={lead.doNotContact} onChange={(e) => (setLead((l) => ({ ...l, doNotContact: e.target.checked })), patch({ doNotContact: e.target.checked }))} />
                Do not contact (they asked to opt out)
              </label>
              {lead.lastContactedAt ? <p className="text-[11.5px] text-muted">Last contacted {formatDateTime(lead.lastContactedAt)}</p> : <p className="text-[11.5px] text-muted">Not contacted yet</p>}
            </div>

            <div className="card p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="section-title">Record conversation</div>
                <button className="btn btn-sm btn-primary" onClick={() => setDialog({ kind: "log", type: "CALL" })}>
                  <Plus size={13} /> Log call / meeting
                </button>
              </div>
              <Recorder businessId={lead.id} recordings={recordings} setRecordings={setRecordings} onSaved={() => api<ActivityItem[]>(`/api/businesses/${lead.id}/activities`).then(setActivities).catch(() => {})} />
            </div>

            <div className="card p-4">
              <div className="section-title mb-2.5">Notes</div>
              <Notes businessId={lead.id} notes={notes} setNotes={setNotes} />
            </div>

            <div className="card p-4">
              <div className="section-title mb-2">Activity timeline</div>
              <Timeline
                items={activities}
                onDelete={async (id) => {
                  await api(`/api/activities/${id}`, { method: "DELETE" });
                  setActivities((a) => a.filter((x) => x.id !== id));
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {dialog?.kind === "log" ? (
        <LogActivityDialog open onClose={() => setDialog(null)} lead={lead} initialType={dialog.type} startedAt={dialog.startedAt} target={dialog.target} onLogged={onLogged} />
      ) : null}
      {dialog?.kind === "wa" ? <WhatsAppDialog open onClose={() => setDialog(null)} lead={lead} settings={settings} number={dialog.number} onLogged={onLogged} extra={extra} /> : null}
      {dialog?.kind === "email" ? (
        <EmailDialog open onClose={() => setDialog(null)} lead={lead} settings={settings} emails={[...lead.emails.map((e) => e.email), ...(lead.siteData?.emails ?? [])]} smtpEnabled={integrations.smtp} onLogged={onLogged} extra={extra} />
      ) : null}
    </div>
  );
}
