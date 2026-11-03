import "server-only";
import type { Activity, Business, Note, Photo, Recording } from "@prisma/client";
import type { ActivityItem, GoogleData, LeadDetail, LeadListItem, NoteItem, Person, Phone, PhotoItem, RecordingItem, SiteData } from "./types";

export function parseJSON<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function photoUrlFor(p: Pick<Photo, "businessId" | "fileName">) {
  return `/api/files/photos/${encodeURIComponent(p.businessId)}/${encodeURIComponent(p.fileName)}`;
}

export function recordingUrlFor(r: Pick<Recording, "businessId" | "fileName">) {
  return `/api/files/recordings/${encodeURIComponent(r.businessId)}/${encodeURIComponent(r.fileName)}`;
}

type WithPhotos = Business & { photos?: Photo[] };

function bestPhoto(b: WithPhotos, google: GoogleData | null): string | null {
  if (b.photos && b.photos.length) return photoUrlFor(b.photos[0]);
  if (b.photoUrl) return b.photoUrl;
  if (google?.photos?.length) return `/api/google-photo?name=${encodeURIComponent(google.photos[0].name)}`;
  return null;
}

export function toListItem(b: WithPhotos): LeadListItem {
  const people = parseJSON<Person[]>(b.people, []);
  const owner = people.find((p) => p.type === "owner") || people[0] || null;
  const google = parseJSON<GoogleData | null>(b.googleData, null);
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    subcategory: b.subcategory,
    area: b.area,
    locality: b.locality,
    zone: b.zone,
    priorityRank: b.priorityRank,
    priorityScore: b.priorityScore,
    interestLevel: b.interestLevel,
    recommendedProduct: b.recommendedProduct,
    attendanceFit: b.attendanceFit,
    socialFit: b.socialFit,
    employeeBand: b.employeeBand,
    employeeEstimate: b.employeeEstimate,
    employeeCountVerified: b.employeeCountVerified,
    branchCount: b.branchCount,
    phones: parseJSON<Phone[]>(b.phones, []),
    email: b.email,
    website: b.website,
    instagram: b.instagram,
    ownerName: owner?.name ?? null,
    ownerRole: owner?.role ?? null,
    status: b.status,
    followUpDate: b.followUpDate,
    followUpNote: b.followUpNote,
    nextAction: b.nextAction,
    dealValue: b.dealValue,
    tags: parseJSON<string[]>(b.tags, []),
    lastContactedAt: iso(b.lastContactedAt),
    photoUrl: bestPhoto(b, google),
    callBlock: b.callBlock,
    bestTimeToCall: b.bestTimeToCall,
    pitch: b.pitch,
    opener: b.opener,
    approach: b.approach,
    confidence: b.confidence,
    doNotContact: b.doNotContact,
    googleRating: b.googleRating,
    googleReviews: b.googleReviews,
    hook: b.hook,
  };
}

export function toActivity(a: Activity & { business?: { name: string } | null }): ActivityItem {
  return {
    id: a.id,
    businessId: a.businessId,
    businessName: a.business?.name,
    type: a.type,
    outcome: a.outcome,
    summary: a.summary,
    details: a.details,
    meta: parseJSON<Record<string, unknown>>(a.meta, {}),
    occurredAt: a.occurredAt.toISOString(),
    createdAt: a.createdAt.toISOString(),
  };
}

export function toNote(n: Note): NoteItem {
  return { id: n.id, kind: n.kind, content: n.content, createdAt: n.createdAt.toISOString(), updatedAt: n.updatedAt.toISOString() };
}

export function toPhoto(p: Photo): PhotoItem {
  return { id: p.id, fileName: p.fileName, caption: p.caption, source: p.source, createdAt: p.createdAt.toISOString(), url: photoUrlFor(p) };
}

export function toRecording(r: Recording): RecordingItem {
  return {
    id: r.id,
    fileName: r.fileName,
    mimeType: r.mimeType,
    durationSec: r.durationSec,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    url: recordingUrlFor(r),
  };
}

export function toDetail(
  b: Business & { activities: Activity[]; notes: Note[]; photos: Photo[]; recordings: Recording[] },
): LeadDetail {
  const base = toListItem(b);
  return {
    ...base,
    address: b.address,
    mapsQuery: b.mapsQuery,
    websiteNote: b.websiteNote,
    instagramNote: b.instagramNote,
    facebook: b.facebook,
    linkedin: b.linkedin,
    youtube: b.youtube,
    description: b.description,
    offerings: b.offerings,
    branches: b.branches,
    ratingsNote: b.ratingsNote,
    googleMapsUri: b.googleMapsUri,
    googleFetchedAt: iso(b.googleFetchedAt),
    googleData: parseJSON<GoogleData | null>(b.googleData, null),
    emails: parseJSON(b.emails, []),
    people: parseJSON(b.people, []),
    decisionMakerPhone: b.decisionMakerPhone,
    decisionMakerEmail: b.decisionMakerEmail,
    decisionMakerLinkedin: b.decisionMakerLinkedin,
    employeeCountSource: b.employeeCountSource,
    employeeEstimateBasis: b.employeeEstimateBasis,
    managementStructure: b.managementStructure,
    attendanceFitReason: b.attendanceFitReason,
    socialFitReason: b.socialFitReason,
    whyProspect: b.whyProspect,
    productReason: b.productReason,
    operationalProblems: parseJSON(b.operationalProblems, []),
    socialPresence: b.socialPresence,
    socialWeaknesses: parseJSON(b.socialWeaknesses, []),
    interestReason: b.interestReason,
    facts: parseJSON(b.facts, []),
    objections: parseJSON(b.objections, []),
    discoveryQuestions: parseJSON(b.discoveryQuestions, []),
    sources: parseJSON(b.sources, []),
    researchDate: b.researchDate,
    verification: b.verification,
    photoSource: b.photoSource,
    siteData: parseJSON<SiteData | null>(b.siteData, null),
    siteFetchedAt: iso(b.siteFetchedAt),
    meetingAt: b.meetingAt,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    activities: b.activities.map((a) => toActivity(a)),
    notes: b.notes.map(toNote),
    photos: b.photos.map(toPhoto),
    recordings: b.recordings.map(toRecording),
  };
}
