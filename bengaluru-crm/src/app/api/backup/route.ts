import { handle, ok } from "@/lib/api";
import { createBackup, listBackups } from "@/lib/backup";
import { BACKUP_DIR } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = handle(async () => ok({ folder: BACKUP_DIR, backups: await listBackups() }));
export const POST = handle(async () => ok({ backup: await createBackup(), backups: await listBackups() }));
