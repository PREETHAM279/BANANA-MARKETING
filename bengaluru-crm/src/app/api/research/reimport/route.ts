import { execFile } from "node:child_process";
import path from "node:path";
import { handle, ok } from "@/lib/api";
import { ROOT_DIR } from "@/lib/db";

export const dynamic = "force-dynamic";

export const POST = handle(async () => {
  const output = await new Promise<string>((resolve, reject) => {
    execFile(process.execPath, [path.join(ROOT_DIR, "scripts", "seed.mjs"), "--force"], { cwd: ROOT_DIR, timeout: 120_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });
  return ok({ output });
});
