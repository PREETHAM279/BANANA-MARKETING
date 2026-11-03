import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/db";
import { MIME_BY_EXT } from "@/lib/uploads";

type Ctx = { params: Promise<{ path: string[] }> };
const SAFE = /^[A-Za-z0-9._-]+$/;

export async function GET(req: Request, { params }: Ctx) {
  const { path: segs } = await params;
  if (segs.length !== 3 || !["photos", "recordings"].includes(segs[0]) || !segs.every((s) => SAFE.test(s) && !s.includes(".."))) {
    return new Response("Not found", { status: 404 });
  }
  const file = path.join(UPLOAD_DIR, ...segs);
  if (!file.startsWith(UPLOAD_DIR + path.sep)) return new Response("Not found", { status: 404 });
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(file);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const ext = path.extname(file).slice(1).toLowerCase();
  const type = MIME_BY_EXT[ext] || "application/octet-stream";
  const headers: Record<string, string> = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" };

  // Byte ranges: Safari requires them to play audio.
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const start = m[1] ? Number(m[1]) : Math.max(0, stat.size - Number(m[2]));
      const end = m[1] && m[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
      if (start <= end && start < stat.size) {
        const buf = Buffer.alloc(end - start + 1);
        const fh = await fs.promises.open(file, "r");
        try {
          await fh.read(buf, 0, buf.length, start);
        } finally {
          await fh.close();
        }
        return new Response(buf, {
          status: 206,
          headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(buf.length) },
        });
      }
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    }
  }
  const data = await fs.promises.readFile(file);
  return new Response(data, { headers: { ...headers, "Content-Length": String(stat.size) } });
}
