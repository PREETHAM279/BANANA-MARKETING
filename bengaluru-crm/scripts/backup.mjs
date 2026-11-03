// Creates a consistent copy of data/crm.db in backups/ using SQLite's VACUUM INTO
// (safe while the CRM is running).
//   node scripts/backup.mjs           -> manual backup
//   node scripts/backup.mjs --daily   -> at most one automatic backup per day, keeps the newest 14
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbFile = path.join(root, "data", "crm.db");
const dir = path.join(root, "backups");
const daily = process.argv.includes("--daily");

const p = (n) => String(n).padStart(2, "0");
const d = new Date();
const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
const stamp = `${day}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;

if (!fs.existsSync(dbFile)) {
  console.log("No database yet - nothing to back up.");
  process.exit(0);
}
fs.mkdirSync(dir, { recursive: true });
if (daily && fs.readdirSync(dir).some((f) => f.startsWith(`crm-${day}`) && f.endsWith("-auto.db"))) {
  console.log("Today's automatic backup already exists.");
  process.exit(0);
}

const name = `crm-${stamp}${daily ? "-auto" : ""}.db`;
const file = path.join(dir, name);
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbFile}` } } });
try {
  await prisma.$executeRawUnsafe(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  console.log(`Backup saved: backups/${name} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
  if (daily) {
    const autos = fs.readdirSync(dir).filter((f) => f.endsWith("-auto.db")).sort().reverse();
    for (const old of autos.slice(14)) fs.rmSync(path.join(dir, old));
  }
} catch (e) {
  console.error("Backup failed:", e.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
