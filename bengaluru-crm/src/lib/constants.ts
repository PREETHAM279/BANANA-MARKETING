export const CATEGORIES = [
  "Restaurants & Cafes",
  "Gyms & Fitness",
  "Retail & Showrooms",
  "Hospitals & Clinics",
  "Salons & Spas",
  "Education",
  "Hotels & Resorts",
  "Warehousing & Logistics",
  "Real Estate",
  "Other Services",
] as const;

export const CATEGORY_TARGETS: Record<string, number> = {
  "Restaurants & Cafes": 15,
  "Gyms & Fitness": 15,
  "Retail & Showrooms": 15,
  "Hospitals & Clinics": 10,
  "Salons & Spas": 10,
  Education: 10,
  "Hotels & Resorts": 10,
  "Warehousing & Logistics": 5,
  "Real Estate": 5,
  "Other Services": 5,
};

export type CategoryMeta = { plural: string; unit: string; units: string; staff: string; short: string };

export const CATEGORY_META: Record<string, CategoryMeta> = {
  "Restaurants & Cafes": { plural: "restaurant and cafe brands", unit: "outlet", units: "outlets", staff: "kitchen and service staff", short: "Restaurants" },
  "Gyms & Fitness": { plural: "gyms and fitness studios", unit: "centre", units: "centres", staff: "trainers and front-desk staff", short: "Gyms" },
  "Retail & Showrooms": { plural: "retail stores and showrooms", unit: "store", units: "stores", staff: "sales staff", short: "Retail" },
  "Hospitals & Clinics": { plural: "hospitals and clinics", unit: "centre", units: "centres", staff: "nursing and support staff", short: "Healthcare" },
  "Salons & Spas": { plural: "salons and spas", unit: "salon", units: "salons", staff: "stylists and therapists", short: "Salons" },
  Education: { plural: "schools and institutes", unit: "campus", units: "campuses", staff: "teachers and staff", short: "Education" },
  "Hotels & Resorts": { plural: "hotels and resorts", unit: "property", units: "properties", staff: "hotel staff across departments", short: "Hotels" },
  "Warehousing & Logistics": { plural: "logistics and warehousing companies", unit: "site", units: "sites", staff: "warehouse and field staff", short: "Logistics" },
  "Real Estate": { plural: "real estate developers", unit: "project", units: "projects", staff: "sales and site teams", short: "Real estate" },
  "Other Services": { plural: "service businesses", unit: "location", units: "locations", staff: "teams", short: "Other" },
};

export const STATUSES = [
  "New Lead",
  "Researched",
  "Not Contacted",
  "Called",
  "WhatsApp Sent",
  "Email Sent",
  "Interested",
  "Meeting Scheduled",
  "Follow-up Required",
  "Negotiation",
  "Converted",
  "Not Interested",
] as const;
export type Status = (typeof STATUSES)[number];

export type Tone = "neutral" | "accent" | "violet" | "warn" | "good" | "bad";
export const STATUS_TONE: Record<string, Tone> = {
  "New Lead": "neutral",
  Researched: "neutral",
  "Not Contacted": "neutral",
  Called: "accent",
  "WhatsApp Sent": "accent",
  "Email Sent": "accent",
  Interested: "violet",
  "Meeting Scheduled": "violet",
  "Follow-up Required": "warn",
  Negotiation: "violet",
  Converted: "good",
  "Not Interested": "bad",
};

export const NOT_CONTACTED_STATUSES = ["New Lead", "Researched", "Not Contacted"];
export const INTERESTED_STATUSES = ["Interested", "Meeting Scheduled", "Negotiation", "Converted"];
export const CLOSED_STATUSES = ["Converted", "Not Interested"];

export const INTEREST_LEVELS = ["High", "Medium", "Low"] as const;
export const FIT_LEVELS = ["High", "Medium", "Low"] as const;
export const PRODUCTS = ["Both", "Social Media", "Attendance"] as const;
export const PRODUCT_LABEL: Record<string, string> = {
  Both: "Both apps",
  "Social Media": "Social Media app",
  Attendance: "Attendance app",
};

export const ZONES = ["Central", "North", "South", "East", "West", "Citywide / Multiple"] as const;
export const EMPLOYEE_BANDS = ["1–10", "11–50", "51–200", "201–500", "500+", "Unknown"] as const;

export const CALL_BLOCKS: Record<number, { label: string; time: string; hint: string }> = {
  1: { label: "Block 1", time: "10:00–11:30 AM", hint: "Offices: schools, hospital admin, real estate, logistics" },
  2: { label: "Block 2", time: "11:30 AM–1:00 PM", hint: "Gyms, salons, retail and service businesses" },
  3: { label: "Block 3", time: "3:00–5:00 PM", hint: "Restaurants and hotels, between service rushes" },
  4: { label: "Block 4", time: "5:00–6:30 PM", hint: "No public phone: email, WhatsApp, website forms, LinkedIn" },
};

export const ACTIVITY_TYPES = ["CALL", "WHATSAPP", "EMAIL", "MEETING", "VISIT", "NOTE", "STATUS", "FOLLOWUP", "SYSTEM", "ENRICH"] as const;
export const ACTIVITY_LABEL: Record<string, string> = {
  CALL: "Call",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  MEETING: "Meeting",
  VISIT: "Visit",
  NOTE: "Note",
  STATUS: "Status change",
  FOLLOWUP: "Follow-up",
  SYSTEM: "System",
  ENRICH: "Data update",
};

export const CALL_OUTCOMES = [
  "Connected - interested",
  "Connected - call back later",
  "Connected - not interested",
  "Connected - meeting booked",
  "Spoke to gatekeeper",
  "No answer",
  "Busy / switched off",
  "Wrong number",
  "Left voicemail",
] as const;

export const WHATSAPP_OUTCOMES = ["Sent", "Replied - interested", "Replied - not now", "Replied - not interested", "No reply yet"] as const;
export const EMAIL_OUTCOMES = ["Sent", "Sent via SMTP", "Replied - interested", "Replied - not now", "Replied - not interested", "Bounced"] as const;
export const MEETING_OUTCOMES = ["Scheduled", "Completed - positive", "Completed - needs follow-up", "Completed - not a fit", "Cancelled / no-show"] as const;
export const VISIT_OUTCOMES = ["Met decision-maker", "Left brochure / card", "Owner not available", "Closed"] as const;

// Which outcomes count as a real contact attempt (updates "last contacted").
export function isContactAttempt(type: string, outcome: string): boolean {
  if (type === "CALL" || type === "MEETING" || type === "VISIT") return true;
  if (type === "WHATSAPP" || type === "EMAIL") return outcome !== "" && outcome !== "No reply yet" && outcome !== "Bounced";
  return false;
}

// Suggested pipeline status after logging an activity.
export function suggestStatus(type: string, outcome: string, current: string): string | null {
  const o = outcome.toLowerCase();
  if (o.includes("not interested") || o.includes("not a fit")) return "Not Interested";
  if (o.includes("meeting booked") || (type === "MEETING" && o.startsWith("scheduled"))) return "Meeting Scheduled";
  if (o.includes("interested") || o.includes("positive")) return current === "Negotiation" ? null : "Interested";
  if (o.includes("call back") || o.includes("not now") || o.includes("needs follow-up")) return "Follow-up Required";
  if (NOT_CONTACTED_STATUSES.includes(current)) {
    if (type === "CALL") return "Called";
    if (type === "WHATSAPP" && o.startsWith("sent")) return "WhatsApp Sent";
    if (type === "EMAIL" && o.startsWith("sent")) return "Email Sent";
    if (type === "VISIT") return "Called";
  }
  return null;
}

export const DEFAULT_SETTINGS: Record<string, string> = {
  yourName: "",
  yourCompany: "",
  yourRole: "Business Development",
  yourPhone: "",
  yourEmail: "",
  productSocial: "our Social Media Management app",
  productAttendance: "our Employee Attendance app",
  demoLink: "",
  signature: "",
  dailyCallTarget: "40",
};
