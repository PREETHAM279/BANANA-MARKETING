import { PageHeader } from "@/components/PageHeader";
import { SettingsClient } from "@/components/SettingsClient";
import { listBackups } from "@/lib/backup";
import { BACKUP_DIR, DATA_DIR, prisma } from "@/lib/db";
import { getSettings, integrationStatus } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings & Data" };

export default async function SettingsPage() {
  const [settings, backups, all, imported] = await Promise.all([
    getSettings(),
    listBackups(),
    prisma.business.findMany({ select: { id: true, name: true, website: true }, orderBy: { priorityRank: "asc" } }),
    prisma.setting.findUnique({ where: { key: "researchImportedAt" } }),
  ]);
  return (
    <>
      <PageHeader title="Settings & data" subtitle="Your details, backups, exports, enrichment and integrations." />
      <SettingsClient
        settings={settings}
        integrations={integrationStatus()}
        backups={backups}
        backupFolder={BACKUP_DIR}
        dataFolder={DATA_DIR}
        enrichable={all.filter((b) => b.website).map((b) => ({ id: b.id, name: b.name }))}
        allIds={all.map((b) => ({ id: b.id, name: b.name }))}
        researchImportedAt={imported?.value ?? null}
      />
    </>
  );
}
