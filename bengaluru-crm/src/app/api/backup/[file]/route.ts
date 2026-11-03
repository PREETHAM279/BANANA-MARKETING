import fs from "node:fs";
import path from "node:path";
import { BACKUP_NAME } from "@/lib/backup";
import { BACKUP_DIR } from "@/lib/db";

type Ctx = { params: Promise<{ file: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { file } = await params;
  if (!BACKUP_NAME.test(file)) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.promises.readFile(path.join(BACKUP_DIR, file));
    return new Response(data, {
      headers: { "Content-Type": "application/x-sqlite3", "Content-Disposition": `attachment; filename="${file}"`, "Content-Length": String(data.length) },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
