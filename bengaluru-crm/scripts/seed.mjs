// Imports the researched businesses (data/research/*.json) into the local SQLite database.
//
// Safe to run any number of times:
//  - research fields (address, contacts, pitch ...) are refreshed from the JSON files
//  - YOUR CRM data (status, notes, activities, follow-ups, deal value, tags, photos,
//    website/Google enrichment) is never touched.
//
// Usage: node scripts/seed.mjs [--force]

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { buildIntel } from "./intel.mjs";

const RESEARCH_DATE = "2026-11-03";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const researchDir = path.join(root, "data", "research");
const dbFile = path.join(root, "data", "crm.db");
const force = process.argv.includes("--force");

const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbFile}` } } });

function loadResearch() {
  const files = fs.readdirSync(researchDir).filter((f) => f.endsWith(".json")).sort();
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(fileURLToPath(new URL("./intel.mjs", import.meta.url))));
  const records = [];
  for (const f of files) {
    const raw = fs.readFileSync(path.join(researchDir, f));
    hash.update(raw);
    const list = JSON.parse(raw.toString("utf8"));
    if (!Array.isArray(list)) throw new Error(`${f} must contain a JSON array`);
    records.push(...list);
  }
  return { records, hash: hash.digest("hex") };
}

async function main() {
  const { records, hash } = loadResearch();
  const ids = new Set();
  for (const r of records) {
    if (!r.id || !r.name || !r.category) throw new Error(`Invalid research record: ${JSON.stringify(r).slice(0, 120)}`);
    if (ids.has(r.id)) throw new Error(`Duplicate research id: ${r.id}`);
    ids.add(r.id);
  }

  const stored = await prisma.setting.findUnique({ where: { key: "researchHash" } });
  const existing = await prisma.business.count();
  if (!force && stored?.value === hash && existing >= records.length) {
    console.log(`Research data unchanged (${existing} businesses) - nothing to import.`);
    return;
  }

  const intel = records.map((r) => buildIntel(r, r.researchDate || RESEARCH_DATE));
  intel.sort((a, b) => b.priorityScore - a.priorityScore || a.name.localeCompare(b.name));
  intel.forEach((b, i) => (b.priorityRank = i + 1));

  let created = 0;
  let updated = 0;
  await prisma.$transaction(async (tx) => {
    for (const b of intel) {
      const found = await tx.business.findUnique({ where: { id: b.id }, select: { id: true } });
      if (found) {
        await tx.business.update({ where: { id: b.id }, data: b });
        updated++;
      } else {
        await tx.business.create({ data: { ...b, status: "Researched" } });
        await tx.activity.create({
          data: {
            businessId: b.id,
            type: "SYSTEM",
            outcome: "Imported",
            summary: "Lead imported from research dataset",
            details: `Research date ${b.researchDate}. Priority rank #${b.priorityRank}.`,
          },
        });
        created++;
      }
    }
    await tx.setting.upsert({ where: { key: "researchHash" }, create: { key: "researchHash", value: hash }, update: { value: hash } });
    await tx.setting.upsert({
      where: { key: "researchImportedAt" },
      create: { key: "researchImportedAt", value: new Date().toISOString() },
      update: { value: new Date().toISOString() },
    });
  }, { timeout: 60_000 });

  const orphans = await prisma.business.findMany({ where: { id: { notIn: [...ids] } }, select: { id: true } });
  console.log(`Imported research: ${created} new, ${updated} refreshed (${intel.length} total).`);
  if (orphans.length) console.log(`Note: ${orphans.length} businesses in your database are not in the research files and were left untouched.`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
