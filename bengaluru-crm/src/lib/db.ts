import path from "node:path";
import { PrismaClient } from "@prisma/client";

export const ROOT_DIR = process.cwd();
export const DATA_DIR = path.join(ROOT_DIR, "data");
export const DB_FILE = path.join(DATA_DIR, "crm.db");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const BACKUP_DIR = path.join(ROOT_DIR, "backups");

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// One connection keeps SQLite writes strictly serialised (single-user local app).
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ datasources: { db: { url: `file:${DB_FILE}?connection_limit=1` } } });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
