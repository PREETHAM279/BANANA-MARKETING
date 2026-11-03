import { NextResponse, type NextRequest } from "next/server";

// Local-only security:
//  - Only answer requests addressed to localhost / 127.0.0.1 / ::1 (blocks DNS-rebinding attacks).
//  - Reject state-changing API calls that come from another website (cross-site request forgery).
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function hostnameOf(hostHeader: string | null): string {
  if (!hostHeader) return "";
  if (hostHeader.startsWith("[")) return hostHeader.slice(0, hostHeader.indexOf("]") + 1);
  return hostHeader.split(":")[0].toLowerCase();
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host");
  if (!LOCAL_HOSTS.has(hostnameOf(host))) {
    return new NextResponse("This CRM only accepts local connections (http://localhost).", { status: 403 });
  }
  const method = req.method.toUpperCase();
  if (req.nextUrl.pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    const origin = req.headers.get("origin");
    const site = req.headers.get("sec-fetch-site");
    if (site && !["same-origin", "none"].includes(site)) {
      return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
    }
    if (origin) {
      try {
        const o = new URL(origin);
        if (!LOCAL_HOSTS.has(o.hostname.toLowerCase()) && !LOCAL_HOSTS.has(`[${o.hostname}]`)) {
          return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Bad origin" }, { status: 403 });
      }
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
