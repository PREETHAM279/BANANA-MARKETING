import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { parseJSON } from "@/lib/serialize";
import type { EmailItem, Person, Phone, Source } from "@/lib/types";
import { isoDate } from "@/lib/format";

export const dynamic = "force-dynamic";

async function loadAll() {
  const [businesses, activities, notes, tasks] = await Promise.all([
    prisma.business.findMany({ orderBy: { priorityRank: "asc" }, include: { _count: { select: { notes: true, activities: true } } } }),
    prisma.activity.findMany({ orderBy: { occurredAt: "desc" }, include: { business: { select: { name: true } } } }),
    prisma.note.findMany({ orderBy: { createdAt: "desc" }, include: { business: { select: { name: true } } } }),
    prisma.outreachTask.findMany({ orderBy: [{ date: "desc" }], include: { business: { select: { name: true } } } }),
  ]);
  return { businesses, activities, notes, tasks };
}

type Row = Record<string, string | number | null>;

function leadRows(businesses: Awaited<ReturnType<typeof loadAll>>["businesses"]): Row[] {
  return businesses.map((b) => {
    const phones = parseJSON<Phone[]>(b.phones, []);
    const emails = parseJSON<EmailItem[]>(b.emails, []);
    const people = parseJSON<Person[]>(b.people, []);
    const sources = parseJSON<Source[]>(b.sources, []);
    return {
      "Priority rank": b.priorityRank,
      "Priority score": b.priorityScore,
      Name: b.name,
      Category: b.category,
      Type: b.subcategory,
      Zone: b.zone,
      Locality: b.locality,
      Address: b.address,
      "Phones (public)": phones.map((p) => `${p.number} [${p.type}] - ${p.label}`).join(" | "),
      "Emails (public)": emails.map((e) => e.email).join(" | "),
      Website: b.website,
      Instagram: b.instagram,
      Facebook: b.facebook,
      LinkedIn: b.linkedin,
      "Decision makers (sourced)": people.map((p) => `${p.name} - ${p.role}`).join(" | ") || "Not publicly verified",
      "Decision-maker phone": b.decisionMakerPhone || "Not publicly verified",
      "Decision-maker email": b.decisionMakerEmail || "Not publicly verified",
      "Interest (assessment)": b.interestLevel,
      "Recommended product": b.recommendedProduct,
      "Attendance fit": b.attendanceFit,
      "Social media fit": b.socialFit,
      "Employees (verified)": b.employeeCountVerified || "Not publicly verified",
      "Employees (estimate)": b.employeeEstimate,
      Branches: b.branches,
      "Google rating": b.googleRating,
      "Google reviews": b.googleReviews,
      Status: b.status,
      "Follow-up date": b.followUpDate,
      "Follow-up note": b.followUpNote,
      "Next action": b.nextAction,
      "Deal value (INR)": b.dealValue,
      Tags: parseJSON<string[]>(b.tags, []).join(", "),
      "Do not contact": b.doNotContact ? "Yes" : "",
      "Last contacted": b.lastContactedAt ? b.lastContactedAt.toISOString() : null,
      "Activities logged": b._count.activities,
      Notes: b._count.notes,
      "Best time to call": b.bestTimeToCall,
      Pitch: b.pitch,
      Opener: b.opener,
      "Why a prospect": b.whyProspect,
      "Research date": b.researchDate,
      Confidence: b.confidence,
      Verification: b.verification,
      Sources: sources.map((s) => s.url).join(" | "),
    };
  });
}

function toCSV(rows: Row[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\r\n");
}

export async function GET(req: Request) {
  const format = new URL(req.url).searchParams.get("format") || "xlsx";
  const all = await loadAll();
  const day = isoDate();

  if (format === "json") {
    const settings = await prisma.setting.findMany();
    const dayNotes = await prisma.dayNote.findMany();
    const photos = await prisma.photo.findMany();
    const recordings = await prisma.recording.findMany();
    return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), ...all, settings, dayNotes, photos, recordings }, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="bengaluru-crm-${day}.json"` },
    });
  }

  const leads = leadRows(all.businesses);
  if (format === "csv") {
    return new Response(toCSV(leads), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="bengaluru-leads-${day}.csv"` },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Bengaluru Sales CRM";
  wb.created = new Date();
  const addSheet = (name: string, rows: Row[], widths: Record<string, number> = {}) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    if (!rows.length) {
      ws.addRow(["No data yet"]);
      return;
    }
    const headers = Object.keys(rows[0]);
    ws.columns = headers.map((h) => ({ header: h, key: h, width: widths[h] ?? Math.min(60, Math.max(12, h.length + 4)) }));
    rows.forEach((r) => ws.addRow(r));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF2FC" } };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  };
  addSheet("Leads", leads, { Name: 32, Address: 50, "Phones (public)": 48, Pitch: 80, Opener: 60, "Why a prospect": 60, Sources: 60, Verification: 50, Branches: 50 });
  addSheet(
    "Activities",
    all.activities.map((a) => ({ When: a.occurredAt.toISOString(), Business: a.business.name, Type: a.type, Outcome: a.outcome, Summary: a.summary, Details: a.details })),
    { Business: 30, Summary: 50, Details: 70 },
  );
  addSheet("Notes", all.notes.map((n) => ({ Created: n.createdAt.toISOString(), Business: n.business.name, Kind: n.kind, Note: n.content })), { Business: 30, Note: 90 });
  addSheet(
    "Outreach plan",
    all.tasks.map((t) => ({ Date: t.date, Business: t.business.name, Done: t.done ? "Yes" : "", "Done at": t.doneAt ? t.doneAt.toISOString() : null, Note: t.note })),
    { Business: 30, Note: 60 },
  );
  addSheet(
    "Sources",
    all.businesses.flatMap((b) => parseJSON<Source[]>(b.sources, []).map((s) => ({ Business: b.name, Source: s.label, URL: s.url, "Research date": b.researchDate }))),
    { Business: 32, Source: 45, URL: 90 },
  );
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bengaluru-crm-${day}.xlsx"`,
    },
  });
}
