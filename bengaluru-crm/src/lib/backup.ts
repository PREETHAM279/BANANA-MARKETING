import "server-only";
import fs from "node:fs";
import path from "node:path";
import { BACKUP_DIR, prisma } from "./db";

export const BACKUP_NAME = /^crm-[0-9A-Za-z_-]+\.db$/;

function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

/** Consistent snapshot of the live database (safe while the app is running). */
export async function createBackup(label = "") {
  await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
  const name = `crm-${stamp()}${label ? `-${label.replace(/[^A-Za-z0-9_-]/g, "")}` : ""}.db`;
  const file = path.join(BACKUP_DIR, name);
  await prisma.$executeRawUnsafe(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const st = await fs.promises.stat(file);
  return { name, size: st.size, createdAt: st.mtime.toISOString() };
}

export async function listBackups() {
  try {
    const names = (await fs.promises.readdir(BACKUP_DIR)).filter((n) => BACKUP_NAME.test(n));
    const items = await Promise.all(
      names.map(async (name) => {
        const st = await fs.promises.stat(path.join(BACKUP_DIR, name));
        return { name, size: st.size, createdAt: st.mtime.toISOString() };
      }),
    );
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}
