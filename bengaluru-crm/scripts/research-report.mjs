// Generates RESEARCHED_BUSINESSES.md and data/research-export/bengaluru-100-leads.csv
// from the research files (no database needed). Run: node scripts/research-report.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildIntel, CATEGORIES } from "./intel.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "data", "research");
const records = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
const intel = records.map((r) => ({ r, b: buildIntel(r, "2026-11-03") }));
intel.sort((x, y) => y.b.priorityScore - x.b.priorityScore || x.b.name.localeCompare(y.b.name));
intel.forEach((x, i) => (x.b.priorityRank = i + 1));

const md = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const people = (r) => (r.people?.length ? r.people.map((p) => `${p.name} (${p.role.split(" (")[0]})`).join("; ") : "Not publicly verified");
const phone = (r) => (r.phones?.length ? `${r.phones[0].number}${r.phones.length > 1 ? ` (+${r.phones.length - 1})` : ""}` : "Not publicly verified");

let out = `# 100 researched Bengaluru prospects

Research date: **3 November 2026** · Method: public web sources (official websites, business press, directories, RERA/registry data).
Every business below was checked to exist, with its location and category confirmed in at least one cited source.
Phone numbers are public business numbers from the cited listings - directory numbers can go stale, so confirm on the first call.
**Nothing was invented:** unknown names, numbers, emails and headcounts are marked "Not publicly verified"; headcounts in the app are labelled estimates unless a source is cited.

| | Count |
|---|---:|
${CATEGORIES.map((c) => `| ${c} | ${records.filter((r) => r.category === c).length} |`).join("\n")}
| **Total** | **${records.length}** |

Coverage: ${records.filter((r) => r.phones?.length).length} with a public phone · ${records.filter((r) => r.people?.length).length} with a named, sourced decision-maker · ${records.filter((r) => r.emails?.length).length} with a public email · ${records.filter((r) => r.website).length} with an official website.

Priority rank = recommended order of attack (interest, product fit, contactability, size). Open each business in the CRM for the full profile, pitch, opener and all sources.

`;
for (const c of CATEGORIES) {
  const rows = intel.filter((x) => x.r.category === c);
  out += `\n## ${c} (${rows.length})\n\n| Rank | Business | Area | Public phone | Decision-maker (sourced) | Interest | Best product | Key source |\n|---:|---|---|---|---|---|---|---|\n`;
  for (const { r, b } of rows.sort((x, y) => x.b.priorityRank - y.b.priorityRank)) {
    const src = r.sources?.[0];
    out += `| ${b.priorityRank} | **${md(r.name)}**<br><sub>${md(r.subcategory)}</sub> | ${md(b.locality)} | ${md(phone(r))} | ${md(people(r))} | ${r.interest} | ${r.product === "Both" ? "Both apps" : r.product} | ${src ? `[${md(src.label)}](${src.url})` : ""} |\n`;
  }
}
fs.writeFileSync(path.join(root, "RESEARCHED_BUSINESSES.md"), out);

const csvRows = [["Priority rank", "Name", "Category", "Type", "Zone", "Locality", "Address", "Phones", "Emails", "Website", "Instagram", "Decision-makers (sourced)", "Employees (verified)", "Employees (estimate)", "Branches", "Interest", "Recommended product", "Best time to call", "Opener", "Pitch", "Confidence", "Verification", "Sources", "Research date"]];
for (const { r, b } of [...intel].sort((x, y) => x.b.priorityRank - y.b.priorityRank)) {
  csvRows.push([
    b.priorityRank, r.name, r.category, r.subcategory, b.zone, b.locality, r.address,
    (r.phones || []).map((p) => `${p.number} (${p.label})`).join(" | ") || "Not publicly verified",
    (r.emails || []).map((e) => e.email).join(" | ") || "Not publicly verified",
    r.website || "Not publicly verified", r.instagram || "Not publicly verified", people(r),
    r.employees?.verified || "Not publicly verified", r.employees?.estimate ? `${r.employees.estimate} (estimate)` : "",
    r.branches, r.interest, r.product, b.bestTimeToCall, b.opener, b.pitch, r.confidence, r.verification,
    (r.sources || []).map((s) => s.url).join(" | "), "2026-11-03",
  ]);
}
const esc = (v) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
fs.mkdirSync(path.join(root, "data", "research-export"), { recursive: true });
fs.writeFileSync(path.join(root, "data", "research-export", "bengaluru-100-leads.csv"), "﻿" + csvRows.map((r) => r.map(esc).join(",")).join("\r\n"));
console.log(`Wrote RESEARCHED_BUSINESSES.md and data/research-export/bengaluru-100-leads.csv (${records.length} businesses)`);
