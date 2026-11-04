// Phone access for the Bengaluru Sales CRM.
//
// Normally the CRM answers only on 127.0.0.1, i.e. on this Mac, with no sign-in. When you switch on
// "Phone access" (Settings & Data, on the Mac), server.mjs also listens on the Mac's *private*
// network addresses (Wi-Fi / Ethernet, and Tailscale if installed) so a phone can open it.
// Every request that does not come from the Mac itself must then carry a session cookie, which a
// phone gets by entering the passcode or by scanning a one-time QR code shown on the Mac.
//
// Security rules enforced here:
//  - Public IP addresses are never bound, and requests from public IPs (or Tailscale Funnel) are refused.
//  - The passcode is stored only as a scrypt hash; wrong attempts are rate limited per device and overall.
//  - Sessions are random 256-bit tokens (only their SHA-256 is stored), sent as HttpOnly, SameSite=Lax cookies.
//  - State-changing requests must come from the same origin (CSRF protection).
//  - Host header allowlist (IP addresses, *.local, *.ts.net, this Mac's names) against DNS rebinding.
//  - Phones can use the CRM but cannot change phone-access settings; only the Mac can.
//  - Requests passed on to Next.js carry a per-process secret (x-crm-gate) that the middleware checks.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import qrcode from "qrcode-generator";

const scrypt = promisify(crypto.scrypt);
const run = promisify(execFile);

export const COOKIE = "crm_phone_session";
const SESSION_DAYS = 90;
const RENEW_AFTER_DAYS = 7;
const MAX_SESSIONS = 25;
const PAIR_MINUTES = 10;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };
const FREE_ATTEMPTS = 5;
const GLOBAL_FAILS_PER_HOUR = 30;
const DAY = 24 * 3600e3;

// Headers a client must never be able to set, and headers that mean "this came through a proxy".
const INTERNAL_HEADERS = ["x-crm-gate", "x-crm-client"];
const PROXY_HEADERS = ["x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port", "forwarded", "x-real-ip", "via", "tailscale-user-login", "tailscale-user-name", "tailscale-user-profile-pic", "tailscale-funnel-request", "tailscale-headers-info"];
// Files a phone may fetch before signing in (needed for "Add to Home Screen"); they contain no CRM data.
const PUBLIC_PATHS = new Set(["/manifest.webmanifest", "/icon.png", "/apple-icon.png", "/favicon.ico", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"]);
const LOCAL_NAMES = new Set(["localhost", "127.0.0.1", "::1"]);

// ---------------------------------------------------------------- small helpers

const iso = (t = Date.now()) => new Date(t).toISOString();
const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const first = (v) => String(Array.isArray(v) ? v[0] : v ?? "").split(",")[0].trim();

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function parseIPv4(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((n) => n <= 255) ? parts : null;
}

export function normalizeIp(ip) {
  const s = String(ip ?? "").trim();
  return s.toLowerCase().startsWith("::ffff:") && parseIPv4(s.slice(7)) ? s.slice(7) : s;
}

// For the automated tests only (the test machine has no private network address).
const TEST_PRIVATE = new Set(String(process.env.CRM_TEST_PRIVATE_ADDRESSES ?? "").split(",").map((s) => s.trim()).filter(Boolean));

/** loopback | private | tailscale (100.64.0.0/10) | linklocal | public */
export function ipKind(raw) {
  const ip = normalizeIp(raw).toLowerCase();
  if (!ip) return "unknown";
  if (TEST_PRIVATE.has(ip)) return "private";
  if (ip === "::1") return "loopback";
  const v4 = parseIPv4(ip);
  if (v4) {
    const [a, b] = v4;
    if (a === 127) return "loopback";
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return "private";
    if (a === 100 && b >= 64 && b <= 127) return "tailscale";
    if (a === 169 && b === 254) return "linklocal";
    return "public";
  }
  if (!ip.includes(":")) return "unknown";
  if (/^f[cd][0-9a-f]{0,2}:/.test(ip)) return "private"; // fc00::/7 unique-local (Tailscale uses fd7a:115c:a1e0::/48)
  if (/^fe[89ab][0-9a-f]?:/.test(ip)) return "linklocal";
  return "public";
}

const CLIENT_OK = new Set(["loopback", "private", "tailscale", "linklocal"]);

/** Lower-case host name from a Host header, without port; IPv6 without brackets. */
export function hostOnly(hostHeader) {
  const h = String(hostHeader ?? "").trim().toLowerCase();
  if (!h) return "";
  if (h.startsWith("[")) {
    const end = h.indexOf("]");
    return end > 0 ? h.slice(1, end) : "";
  }
  const colon = h.indexOf(":");
  if (colon !== h.lastIndexOf(":")) return h; // bare IPv6 without brackets
  return (colon >= 0 ? h.slice(0, colon) : h).replace(/\.$/, "");
}

export function isLocalHost(hostHeader) {
  return LOCAL_NAMES.has(hostOnly(hostHeader));
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

export function deviceLabel(ua = "") {
  const dev = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android phone" : /Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows PC" : /Linux/.test(ua) ? "Linux" : "Device";
  let browser = "browser";
  if (/EdgA?\/|EdgiOS/.test(ua)) browser = "Edge";
  else if (/SamsungBrowser/.test(ua)) browser = "Samsung Internet";
  else if (/CriOS|Chrome\//.test(ua)) browser = "Chrome";
  else if (/FxiOS|Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";
  else if (/iPhone|iPad/.test(ua) && /AppleWebKit/.test(ua)) browser = "Home Screen app";
  return `${dev} · ${browser}`;
}

export function normalizePasscode(p) {
  return String(p ?? "").normalize("NFKC").replace(/\s+/g, "");
}

export function passcodeProblem(p) {
  if (p.length < 6) return "Use at least 6 characters.";
  if (p.length > 64) return "Use at most 64 characters.";
  if (/^(.)\1+$/.test(p)) return "Don't repeat a single character.";
  if ("012345678901234567890".includes(p) || "098765432109876543210".includes(p)) return "Avoid simple sequences like 123456.";
  return null;
}

function generatePasscode() {
  for (;;) {
    const p = String(crypto.randomInt(0, 100_000_000)).padStart(8, "0");
    if (!passcodeProblem(p)) return p;
  }
}

function safeNext(n) {
  const s = String(n ?? "");
  if (!s.startsWith("/") || s.startsWith("//") || s.startsWith("/\\") || s.startsWith("/__crm/") || s.length > 600 || /[\r\n]/.test(s)) return "/";
  return s;
}

function qrSvg(text) {
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 3, scalable: true });
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("Request too large"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// ---------------------------------------------------------------- responses

const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  // same-origin (not no-referrer): browsers then send a real Origin header on our own form posts.
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "DENY",
};

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { ...BASE_HEADERS, "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(body));
}

function sendText(res, status, text) {
  res.writeHead(status, { ...BASE_HEADERS, "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function sendHtml(res, status, body, headers = {}) {
  res.writeHead(status, {
    ...BASE_HEADERS,
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; manifest-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    ...headers,
  });
  res.end(body);
}

function redirect(res, location, headers = {}) {
  res.writeHead(303, { ...BASE_HEADERS, Location: location, ...headers });
  res.end();
}

const LOGO = `<svg width="20" height="20" viewBox="0 0 100 100" aria-hidden="true"><path d="M34 24V76M34 24H55a13 13 0 0 1 0 26H34M34 50H58a13 13 0 0 1 0 26H34" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function page(title, inner) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#f6f6f4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0d0d0c" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Sales CRM">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/apple-icon.png">
<title>${escapeHtml(title)} · Bengaluru Sales CRM</title>
<style>
:root{color-scheme:light dark;--bg:#f6f6f4;--surface:#fff;--line:rgba(11,11,11,.09);--line-strong:rgba(11,11,11,.17);--ink:#0b0b0b;--muted:#6b6a65;--accent:#2a78d6;--accent-hover:#256abf;--accent-soft:#eaf2fc;--bad:#a32626;--bad-soft:#fbeaea;--warn:#7a5000;--warn-soft:#fff4d9}
@media (prefers-color-scheme:dark){:root{--bg:#0d0d0c;--surface:#171716;--line:rgba(255,255,255,.08);--line-strong:rgba(255,255,255,.15);--ink:#f0efec;--muted:#9a998f;--accent:#3987e5;--accent-hover:#5598e7;--accent-soft:rgba(57,135,229,.15);--bad:#ef7373;--bad-soft:rgba(208,59,59,.17);--warn:#fab219;--warn-soft:rgba(250,178,25,.13)}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px max(16px,env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"SF Pro Text","Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
main{width:100%;max-width:390px;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:26px 22px 22px;box-shadow:0 12px 40px rgba(11,11,11,.08)}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:22px}
.logo{width:34px;height:34px;flex:none;border-radius:9px;background:#2a78d6;display:flex;align-items:center;justify-content:center}
.brand b{display:block;font-size:14.5px;line-height:1.2}.brand span{font-size:12.5px;color:var(--muted)}
h1{font-size:21px;line-height:1.25;margin:0 0 6px;letter-spacing:-.01em}
p{margin:0 0 16px;color:var(--muted);font-size:14px}
p b{color:var(--ink);font-weight:600}
label{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
input[type=password]{width:100%;height:54px;border-radius:12px;border:1px solid var(--line-strong);background:var(--surface);color:var(--ink);font-size:24px;letter-spacing:.2em;text-align:center;padding:0 12px}
input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-soft)}
button,.button{display:flex;align-items:center;justify-content:center;margin-top:14px;width:100%;height:50px;border:0;border-radius:12px;background:var(--accent);color:#fff;font-family:inherit;font-size:16px;font-weight:600;line-height:1;text-decoration:none;cursor:pointer}
button:hover,.button:hover{background:var(--accent-hover)}
.msg{border-radius:10px;padding:10px 12px;font-size:13.5px;margin:0 0 14px}
.err{background:var(--bad-soft);color:var(--bad)}
.warn{background:var(--warn-soft);color:var(--warn)}
.help{margin-top:18px;padding-top:14px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
.help b{color:var(--ink);font-weight:600}
</style>
</head><body><main>
<div class="brand"><div class="logo">${LOGO}</div><div><b>Bengaluru Sales CRM</b><span>Private · runs on your Mac</span></div></div>
${inner}
</main></body></html>`;
}

// ---------------------------------------------------------------- the gate

export function createGate({ dataDir, port, gateToken, nextHandler, log = (...a) => console.log(new Date().toISOString(), ...a) }) {
  const file = path.join(dataDir, "phone-access.json");
  let state = load();
  let saveTimer = null;
  const listeners = new Set();
  const pairTokens = new Map(); // sha256(token) -> expiry (ms); kept in memory only, single use
  const failures = new Map(); // client ip -> { count, last, lockedUntil }
  let recentFailures = []; // timestamps of failed sign-ins from any device (last hour)
  let globalLockUntil = 0;
  const env = { localHostName: "", hardwarePorts: {}, tailscale: null, tailscaleAt: 0 };
  discoverMacNames();

  function load() {
    const empty = { version: 1, enabled: false, passcode: null, sessions: [] };
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      return { ...empty, ...raw, sessions: Array.isArray(raw.sessions) ? raw.sessions : [] };
    } catch (e) {
      if (e.code !== "ENOENT") log("phone-access: could not read", file, "-", e.message, "- starting with phone access off");
      return empty;
    }
  }

  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    fs.mkdirSync(dataDir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, file);
  }

  function saveSoon() {
    if (!saveTimer) saveTimer = setTimeout(() => {
      try {
        saveNow();
      } catch (e) {
        log("phone-access: save failed", e.message);
      }
    }, 60_000);
    saveTimer.unref?.();
  }

  function changed() {
    saveNow();
    for (const fn of listeners) fn(state.enabled);
  }

  // ---------- environment discovery (names shown to the user)

  async function discoverMacNames() {
    if (process.platform !== "darwin") return;
    try {
      env.localHostName = (await run("scutil", ["--get", "LocalHostName"], { timeout: 3000 })).stdout.trim();
    } catch {
      /* not critical */
    }
    try {
      const out = (await run("networksetup", ["-listallhardwareports"], { timeout: 4000 })).stdout;
      for (const block of out.split(/\n\s*\n/)) {
        const portName = /Hardware Port:\s*(.+)/.exec(block)?.[1]?.trim();
        const dev = /Device:\s*(\S+)/.exec(block)?.[1]?.trim();
        if (portName && dev) env.hardwarePorts[dev] = portName;
      }
    } catch {
      /* not critical */
    }
  }

  async function detectTailscale() {
    if (env.tailscale && Date.now() - env.tailscaleAt < 30_000) return env.tailscale;
    const candidates = ["/Applications/Tailscale.app/Contents/MacOS/Tailscale", "/opt/homebrew/bin/tailscale", "/usr/local/bin/tailscale", "/usr/bin/tailscale"];
    const cli = candidates.find((c) => fs.existsSync(c));
    const result = { installed: Boolean(cli), running: false, dnsName: "", httpsUrl: "", funnel: false };
    if (cli) {
      try {
        const st = JSON.parse((await run(cli, ["status", "--json"], { timeout: 3000 })).stdout);
        result.running = st.BackendState === "Running";
        result.dnsName = String(st.Self?.DNSName ?? "").replace(/\.$/, "").toLowerCase();
      } catch {
        /* Tailscale not running */
      }
      if (result.running) {
        try {
          const serve = JSON.parse((await run(cli, ["serve", "status", "--json"], { timeout: 3000 })).stdout || "{}");
          for (const [hostPort, web] of Object.entries(serve.Web ?? {})) {
            const target = String(web?.Handlers?.["/"]?.Proxy ?? "");
            if (new RegExp(`(^|[:/])${port}/?$`).test(target)) {
              result.httpsUrl = `https://${hostPort.replace(/:443$/, "")}`;
              if (serve.AllowFunnel?.[hostPort]) result.funnel = true;
            }
          }
        } catch {
          /* serve not configured */
        }
      }
    }
    env.tailscale = result;
    env.tailscaleAt = Date.now();
    return result;
  }

  /** Private IPv4 addresses of this Mac that phones can reach (never public ones). */
  function networkAddresses() {
    const out = [];
    for (const [iface, list] of Object.entries(os.networkInterfaces())) {
      for (const a of list ?? []) {
        if (a.internal || !(a.family === "IPv4" || a.family === 4)) continue;
        const kind = ipKind(a.address);
        if (kind === "private") out.push({ iface, address: a.address, kind: "lan", label: env.hardwarePorts[iface] || (iface.startsWith("en") ? "Wi-Fi / Ethernet" : "Local network") });
        else if (kind === "tailscale" && /^(utun|tailscale)/.test(iface)) out.push({ iface, address: a.address, kind: "tailscale", label: "Tailscale" });
        else if (kind === "tailscale") out.push({ iface, address: a.address, kind: "lan", label: env.hardwarePorts[iface] || "Local network" });
      }
    }
    return out.sort((x, y) => (x.kind === y.kind ? x.iface.localeCompare(y.iface) : x.kind === "lan" ? -1 : 1));
  }

  function machineNames() {
    const names = new Set();
    const h = os.hostname().toLowerCase();
    names.add(h);
    names.add(h.replace(/\.local$/, ""));
    if (env.localHostName) names.add(env.localHostName.toLowerCase());
    if (env.tailscale?.dnsName) names.add(env.tailscale.dnsName.split(".")[0]);
    return names;
  }

  function isAllowedRemoteHost(hostHeader) {
    const h = hostOnly(hostHeader);
    if (!h) return false;
    if (LOCAL_NAMES.has(h) || parseIPv4(h) || h.includes(":")) return true; // IP literals can't be used for DNS rebinding
    if (h.endsWith(".local") || h.endsWith(".ts.net")) return true;
    return machineNames().has(h);
  }

  // ---------- sessions

  function findSession(req) {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (!token || token.length < 20 || token.length > 100) return null;
    const id = sha256(token);
    const s = state.sessions.find((x) => x.id === id);
    if (!s) return null;
    if (Date.parse(s.expiresAt) < Date.now()) {
      state.sessions = state.sessions.filter((x) => x !== s);
      saveSoon();
      return null;
    }
    return s;
  }

  function cookie(value, maxAgeSec, secure) {
    return [`${COOKIE}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSec}`, secure ? "Secure" : ""].filter(Boolean).join("; ");
  }

  function viaLabel(ctx) {
    if (ctx.proxied) return ctx.https ? "Tailscale (HTTPS)" : "Proxy";
    return ipKind(ctx.clientIp) === "tailscale" ? "Tailscale" : "Wi-Fi / local network";
  }

  function createSession(req, ctx) {
    const token = crypto.randomBytes(32).toString("base64url");
    const now = Date.now();
    const rec = {
      id: sha256(token),
      device: deviceLabel(String(req.headers["user-agent"] ?? "")),
      ip: ctx.clientIp,
      via: viaLabel(ctx),
      createdAt: iso(now),
      lastSeenAt: iso(now),
      expiresAt: iso(now + SESSION_DAYS * DAY),
      renewedAt: iso(now),
    };
    state.sessions.push(rec);
    if (state.sessions.length > MAX_SESSIONS) {
      state.sessions.sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt));
      state.sessions.length = MAX_SESSIONS;
    }
    saveNow();
    log(`phone-access: signed in ${rec.device} from ${rec.ip} (${rec.via})`);
    return { token, rec, setCookie: cookie(token, SESSION_DAYS * 86400, ctx.https) };
  }

  // ---------- brute-force protection

  function lockRemaining(ip) {
    const now = Date.now();
    if (globalLockUntil > now) return globalLockUntil - now;
    const f = failures.get(ip);
    return f && f.lockedUntil > now ? f.lockedUntil - now : 0;
  }

  function noteFailure(ip, what) {
    const now = Date.now();
    if (failures.size > 5000) failures.clear();
    const f = failures.get(ip) ?? { count: 0, last: 0, lockedUntil: 0 };
    if (now - f.last > DAY) f.count = 0;
    f.count += 1;
    f.last = now;
    if (f.count >= FREE_ATTEMPTS) f.lockedUntil = now + Math.min(60e3 * 2 ** (f.count - FREE_ATTEMPTS), 6 * 3600e3);
    failures.set(ip, f);
    recentFailures = recentFailures.filter((t) => now - t < 3600e3);
    recentFailures.push(now);
    if (recentFailures.length >= GLOBAL_FAILS_PER_HOUR) globalLockUntil = now + 15 * 60e3;
    log(`phone-access: wrong ${what} from ${ip} (${f.count} in a row)`);
    return { left: Math.max(0, FREE_ATTEMPTS - f.count), lockedFor: lockRemaining(ip) };
  }

  function resetLocks() {
    failures.clear();
    recentFailures = [];
    globalLockUntil = 0;
  }

  const minutes = (ms) => Math.max(1, Math.ceil(ms / 60e3));

  // Passcode checks run one at a time: scrypt is deliberately slow and memory-hungry, and a queue means
  // a burst of guesses can't overtake the lock that the fifth wrong one sets.
  let checkQueue = Promise.resolve();
  function oneAtATime(fn) {
    const result = checkQueue.then(fn);
    checkQueue = result.catch(() => {});
    return result;
  }

  // ---------- pairing (QR code)

  function newPairToken() {
    const now = Date.now();
    for (const [k, exp] of pairTokens) if (exp < now) pairTokens.delete(k);
    while (pairTokens.size >= 5) pairTokens.delete(pairTokens.keys().next().value);
    const token = crypto.randomBytes(24).toString("base64url");
    const expiresAt = now + PAIR_MINUTES * 60e3;
    pairTokens.set(sha256(token), expiresAt);
    return { token, expiresAt };
  }

  function checkPairToken(token, consume) {
    const key = sha256(token);
    const exp = pairTokens.get(key);
    if (!exp || exp < Date.now()) {
      pairTokens.delete(key);
      return false;
    }
    if (consume) pairTokens.delete(key);
    return true;
  }

  // ---------- status for the Settings page

  async function addresses() {
    const ts = await detectTailscale();
    const list = [];
    const nets = networkAddresses();
    const listening = new Set(currentListening());
    for (const a of nets.filter((n) => n.kind === "lan")) list.push({ kind: "lan", label: a.label, url: `http://${a.address}:${port}`, listening: listening.has(a.address) });
    if (env.localHostName && nets.some((n) => n.kind === "lan")) list.push({ kind: "mdns", label: "Mac name", url: `http://${env.localHostName}.local:${port}`, listening: nets.some((n) => n.kind === "lan" && listening.has(n.address)) });
    if (ts.httpsUrl) list.push({ kind: "tailscale-https", label: "Tailscale (HTTPS)", url: ts.httpsUrl, listening: true });
    for (const a of nets.filter((n) => n.kind === "tailscale")) {
      if (ts.dnsName) list.push({ kind: "tailscale-name", label: "Tailscale name", url: `http://${ts.dnsName}:${port}`, listening: listening.has(a.address) });
      list.push({ kind: "tailscale", label: "Tailscale", url: `http://${a.address}:${port}`, listening: listening.has(a.address) });
    }
    return { list, tailscale: ts };
  }

  let currentListening = () => [];

  async function macStatus() {
    const { list, tailscale } = await addresses();
    const now = Date.now();
    return {
      available: true,
      client: "mac",
      enabled: state.enabled,
      port,
      passcode: state.passcode ? { set: true, setAt: state.passcode.setAt, digitsOnly: state.passcode.digitsOnly } : { set: false },
      addresses: list,
      tailscale: { installed: tailscale.installed, running: tailscale.running, https: Boolean(tailscale.httpsUrl), funnel: tailscale.funnel },
      sessions: state.sessions
        .filter((s) => Date.parse(s.expiresAt) > now)
        .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt))
        .map(({ id, device, ip, via, createdAt, lastSeenAt, expiresAt }) => ({ id, device, ip, via, createdAt, lastSeenAt, expiresAt })),
      security: {
        failedLastHour: recentFailures.filter((t) => now - t < 3600e3).length,
        lockedUntil: globalLockUntil > now ? iso(globalLockUntil) : null,
      },
    };
  }

  // ---------- request classification

  function classify(req, listener) {
    if (listener === "loopback") {
      const proxied = PROXY_HEADERS.some((h) => req.headers[h] !== undefined);
      if (!proxied) return { local: true };
      // Arrived through a proxy on this Mac (e.g. `tailscale serve`): it represents another device.
      const xff = String(req.headers["x-forwarded-for"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      return {
        local: false,
        proxied: true,
        clientIp: normalizeIp(xff.at(-1) || first(req.headers["x-real-ip"])),
        https: first(req.headers["x-forwarded-proto"]).toLowerCase() === "https",
        funnel: req.headers["tailscale-funnel-request"] !== undefined,
        host: first(req.headers["x-forwarded-host"]) || String(req.headers.host ?? ""),
      };
    }
    // Direct connection to a Wi-Fi/Tailscale address: forwarding headers from the client are meaningless.
    for (const h of PROXY_HEADERS) delete req.headers[h];
    return { local: false, proxied: false, clientIp: normalizeIp(req.socket.remoteAddress), https: false, funnel: false, host: String(req.headers.host ?? "") };
  }

  /** Unsafe requests must come from the CRM's own pages: a matching Origin, or (if the browser hid it) Sec-Fetch-Site. */
  function sameOrigin(req, host) {
    const site = req.headers["sec-fetch-site"];
    if (site && site !== "same-origin") return false;
    const origin = req.headers.origin;
    if (origin && origin !== "null") {
      try {
        return new URL(origin).host.toLowerCase() === String(host).toLowerCase();
      } catch {
        return false;
      }
    }
    return site === "same-origin";
  }

  function localOriginOk(req) {
    const site = req.headers["sec-fetch-site"];
    if (site && site !== "same-origin") return false;
    if (!req.headers.origin) return true;
    try {
      return LOCAL_NAMES.has(hostOnly(new URL(req.headers.origin).host));
    } catch {
      return false;
    }
  }

  // ---------- pages

  function loginPage(res, status, { next = "/", error = "", notice = "" } = {}) {
    const digits = state.passcode?.digitsOnly !== false;
    const body = page(
      "Sign in",
      `<h1>Sign in on this device</h1>
<p>Enter the passcode shown on your Mac.</p>
${error ? `<div class="msg err" role="alert">${escapeHtml(error)}</div>` : ""}${notice ? `<div class="msg warn" role="status">${escapeHtml(notice)}</div>` : ""}
<form method="post" action="/__crm/login">
<input type="hidden" name="next" value="${escapeHtml(safeNext(next))}">
<label for="passcode">Passcode</label>
<input id="passcode" name="passcode" type="password" ${digits ? 'inputmode="numeric" pattern="[0-9 ]*"' : ""} autocomplete="current-password" enterkeyhint="go" required autofocus maxlength="80">
<button type="submit">Sign in</button>
</form>
<div class="help">Find the passcode on your Mac: open the CRM, then <b>Settings &amp; Data → Phone access</b>. Or scan the QR code shown there with this phone's camera.</div>`,
    );
    sendHtml(res, status, body);
  }

  function messagePage(res, status, title, text, button) {
    sendHtml(res, status, page(title, `<h1>${escapeHtml(title)}</h1><p>${text}</p>${button ? `<a class="button" href="${escapeHtml(button.href)}">${escapeHtml(button.label)}</a>` : ""}`));
  }

  async function loginSubmit(req, res, ctx) {
    if (!String(req.headers["content-type"] ?? "").includes("application/x-www-form-urlencoded")) return sendText(res, 415, "Unsupported form");
    const form = new URLSearchParams(await readBody(req, 4096));
    const next = safeNext(form.get("next"));
    if (!state.passcode) return loginPage(res, 409, { next, error: "No passcode has been set yet. On your Mac, open Settings & Data → Phone access." });
    const pass = normalizePasscode(form.get("passcode"));
    const outcome = await oneAtATime(async () => {
      const locked = lockRemaining(ctx.clientIp);
      if (locked) return { locked };
      const rec = state.passcode;
      const got = pass ? await scrypt(pass, Buffer.from(rec.salt, "base64"), SCRYPT.keylen, { N: rec.N, r: rec.r, p: rec.p, maxmem: 64 * 1024 * 1024 }) : Buffer.alloc(0);
      const want = Buffer.from(rec.hash, "base64");
      if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return { failed: noteFailure(ctx.clientIp, "passcode") };
      failures.delete(ctx.clientIp);
      return { ok: true };
    });
    if (outcome.locked) return loginPage(res, 429, { next, error: `Too many wrong passcodes. Try again in ${minutes(outcome.locked)} minute${minutes(outcome.locked) === 1 ? "" : "s"}, or create a new passcode on your Mac.` });
    if (outcome.failed) {
      const f = outcome.failed;
      const error = f.lockedFor ? `Wrong passcode. Sign-in is paused for ${minutes(f.lockedFor)} minute${minutes(f.lockedFor) === 1 ? "" : "s"}.` : `Wrong passcode. ${f.left} more ${f.left === 1 ? "try" : "tries"} before a short pause.`;
      return loginPage(res, 401, { next, error });
    }
    const s = createSession(req, ctx);
    redirect(res, next, { "Set-Cookie": s.setCookie });
  }

  function pairPage(res, url) {
    const t = url.searchParams.get("t") ?? "";
    if (!t || !checkPairToken(t, false)) {
      return messagePage(res, 410, "This QR code has expired", "Codes work once and for 10 minutes. On your Mac, click <b>Show QR code</b> again, or sign in with the passcode.", { href: "/__crm/login", label: "Sign in with passcode" });
    }
    sendHtml(
      res,
      200,
      page(
        "Sign in this phone",
        `<h1>Sign in this phone?</h1>
<p>This connects this phone to the CRM running on your Mac. Continue only if you scanned the code on <b>your own</b> Mac's screen.</p>
<form method="post" action="/__crm/pair"><input type="hidden" name="t" value="${escapeHtml(t)}"><button type="submit">Sign in</button></form>`,
      ),
    );
  }

  async function pairSubmit(req, res, ctx) {
    if (!String(req.headers["content-type"] ?? "").includes("application/x-www-form-urlencoded")) return sendText(res, 415, "Unsupported form");
    const form = new URLSearchParams(await readBody(req, 4096));
    const locked = lockRemaining(ctx.clientIp);
    if (locked) return messagePage(res, 429, "Please wait", `Too many failed attempts. Try again in ${minutes(locked)} minutes.`, null);
    if (!checkPairToken(form.get("t") ?? "", true)) {
      noteFailure(ctx.clientIp, "QR code");
      return messagePage(res, 410, "This QR code has expired", "Codes work once and for 10 minutes. On your Mac, click <b>Show QR code</b> again, or sign in with the passcode.", { href: "/__crm/login", label: "Sign in with passcode" });
    }
    const s = createSession(req, ctx);
    redirect(res, "/", { "Set-Cookie": s.setCookie });
  }

  // ---------- Mac-only management API (/__crm/phone/*)

  async function readJson(req) {
    const text = await readBody(req, 8192);
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw Object.assign(new Error("Invalid JSON body"), { status: 400 });
    }
  }

  async function setPasscode(pass) {
    const salt = crypto.randomBytes(16);
    const hash = await scrypt(pass, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
    state.passcode = { salt: salt.toString("base64"), hash: hash.toString("base64"), N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, digitsOnly: /^\d+$/.test(pass), setAt: iso() };
    resetLocks();
  }

  async function localEndpoint(req, res, url) {
    const method = req.method.toUpperCase();
    const p = url.pathname;
    if (!isLocalHost(req.headers.host)) return sendText(res, 403, "This CRM only accepts local connections (http://localhost).");
    if (p === "/__crm/login" || p === "/__crm/pair") return redirect(res, "/"); // the Mac never needs to sign in
    if (method !== "GET" && method !== "HEAD") {
      if (!localOriginOk(req)) return sendJson(res, 403, { error: "Cross-site request blocked" });
      if (!String(req.headers["content-type"] ?? "").includes("application/json")) return sendJson(res, 415, { error: "Expected application/json" });
    }
    const route = `${method} ${p}`;
    if (route === "GET /__crm/phone/status") return sendJson(res, 200, await macStatus());
    if (route === "POST /__crm/phone/enable") {
      const body = await readJson(req);
      let passcode;
      if (body.enabled && !state.passcode) {
        passcode = generatePasscode();
        await setPasscode(passcode);
      }
      state.enabled = Boolean(body.enabled);
      changed();
      log(`phone-access: turned ${state.enabled ? "on" : "off"}`);
      return sendJson(res, 200, { ...(await macStatus()), newPasscode: passcode });
    }
    if (route === "POST /__crm/phone/passcode") {
      const body = await readJson(req);
      const custom = body.passcode != null ? normalizePasscode(body.passcode) : null;
      if (custom != null) {
        const problem = passcodeProblem(custom);
        if (problem) return sendJson(res, 400, { error: problem });
      }
      const passcode = custom ?? generatePasscode();
      await setPasscode(passcode);
      if (body.signOutAll) state.sessions = [];
      changed();
      log(`phone-access: passcode changed${body.signOutAll ? " and all phones signed out" : ""}`);
      return sendJson(res, 200, { ...(await macStatus()), newPasscode: custom == null ? passcode : undefined });
    }
    if (route === "POST /__crm/phone/pair") {
      if (!state.enabled) return sendJson(res, 409, { error: "Turn on phone access first." });
      const { token, expiresAt } = newPairToken();
      const { list } = await addresses();
      const links = list.map((a) => {
        const link = `${a.url}/__crm/pair?t=${token}`;
        return { kind: a.kind, label: a.label, url: a.url, link, svg: qrSvg(link) };
      });
      return sendJson(res, 200, { expiresAt: iso(expiresAt), links });
    }
    if (route === "POST /__crm/phone/signout") {
      const body = await readJson(req);
      const before = state.sessions.length;
      state.sessions = body.id ? state.sessions.filter((s) => s.id !== body.id) : [];
      changed();
      log(`phone-access: signed out ${before - state.sessions.length} device(s)`);
      return sendJson(res, 200, await macStatus());
    }
    if (route === "POST /__crm/phone/unlock") {
      resetLocks();
      return sendJson(res, 200, await macStatus());
    }
    return sendJson(res, 404, { error: "Not found" });
  }

  // ---------- remote (phone) requests

  function passToNext(req, res, client) {
    req.headers["x-crm-gate"] = gateToken;
    req.headers["x-crm-client"] = client;
    return nextHandler(req, res);
  }

  async function remoteRequest(req, res, ctx, url) {
    const method = req.method.toUpperCase();
    const p = url.pathname;
    if (ctx.funnel) return sendText(res, 403, "This CRM is private and is not available on the public internet.");
    if (!CLIENT_OK.has(ipKind(ctx.clientIp))) {
      log(`phone-access: refused ${ctx.clientIp || "unknown address"} (not a private network)`);
      return sendText(res, 403, "Only devices on your own network (or your Tailscale network) can open this CRM.");
    }
    if (!isAllowedRemoteHost(ctx.host)) return sendText(res, 403, "Unknown address. Open the CRM using the address shown on your Mac.");
    if (!state.enabled) return messagePage(res, 403, "Phone access is off", "Turn it on from your Mac: open the CRM, then <b>Settings &amp; Data → Phone access</b>.", null);
    const unsafe = !["GET", "HEAD", "OPTIONS"].includes(method);
    if (unsafe && !sameOrigin(req, ctx.host)) return sendJson(res, 403, { error: "Cross-site request blocked" });

    if (p === "/__crm/login") {
      if (method === "POST") return loginSubmit(req, res, ctx);
      if (findSession(req)) return redirect(res, safeNext(url.searchParams.get("next")));
      return loginPage(res, 200, { next: url.searchParams.get("next") ?? "/", notice: url.searchParams.has("bye") ? "You're signed out on this device." : "" });
    }
    if (p === "/__crm/pair") return method === "POST" ? pairSubmit(req, res, ctx) : pairPage(res, url);
    if (PUBLIC_PATHS.has(p) && PUBLIC_PATHS.has(String(req.url).split("?")[0])) {
      if (method !== "GET" && method !== "HEAD") return sendText(res, 405, "Method not allowed");
      return passToNext(req, res, "phone");
    }

    const session = findSession(req);
    if (!session) {
      const accept = String(req.headers.accept ?? "");
      if ((method === "GET" || method === "HEAD") && !p.startsWith("/api/") && !p.startsWith("/_next/") && !p.startsWith("/__crm/") && accept.includes("text/html")) {
        return redirect(res, `/__crm/login?next=${encodeURIComponent(safeNext(p + url.search))}`);
      }
      return sendJson(res, 401, { error: "Please sign in again on this device.", signIn: "/__crm/login" });
    }

    // Keep the session alive while it's being used (and remember where it was last used).
    const now = Date.now();
    session.lastSeenAt = iso(now);
    session.ip = ctx.clientIp;
    if (now - Date.parse(session.renewedAt ?? session.createdAt) > RENEW_AFTER_DAYS * DAY) {
      const token = parseCookies(req.headers.cookie)[COOKIE];
      session.renewedAt = iso(now);
      session.expiresAt = iso(now + SESSION_DAYS * DAY);
      res.setHeader("Set-Cookie", cookie(token, SESSION_DAYS * 86400, ctx.https));
    }
    saveSoon();

    if (p === "/__crm/logout") {
      if (method !== "POST") return sendText(res, 405, "Method not allowed");
      state.sessions = state.sessions.filter((s) => s !== session);
      saveNow();
      log(`phone-access: ${session.device} signed out`);
      const clear = cookie("", 0, ctx.https);
      if (String(req.headers.accept ?? "").includes("application/json")) return sendJson(res, 200, { ok: true }, { "Set-Cookie": clear });
      return redirect(res, "/__crm/login?bye=1", { "Set-Cookie": clear });
    }
    if (p === "/__crm/phone/status" && method === "GET") {
      return sendJson(res, 200, { available: true, client: "phone", enabled: true, device: session.device, via: session.via, signedInAt: session.createdAt, expiresAt: session.expiresAt, https: ctx.https });
    }
    if (p.startsWith("/__crm/")) return sendJson(res, 403, { error: "Phone access settings can only be changed on the Mac." });
    return passToNext(req, res, "phone");
  }

  // ---------- entry point

  async function handleRequest(req, res, listener) {
    try {
      for (const h of INTERNAL_HEADERS) delete req.headers[h];
      const ctx = classify(req, listener);
      const url = new URL(req.url || "/", "http://crm.invalid");
      if (ctx.local) {
        if (url.pathname.startsWith("/__crm/")) return await localEndpoint(req, res, url);
        req.headers["x-crm-client"] = "mac";
        return await nextHandler(req, res);
      }
      return await remoteRequest(req, res, ctx, url);
    } catch (e) {
      log("request error:", e?.stack || e);
      if (!res.headersSent) sendJson(res, e?.status || 500, { error: e?.status ? e.message : "Unexpected error" });
      else res.end();
    }
  }

  return {
    handleRequest,
    /** Addresses the phone listeners should be bound to right now. */
    wantedAddresses: () => (state.enabled ? networkAddresses().map((a) => a.address) : []),
    setListeningProvider(fn) {
      currentListening = fn;
    },
    onChange(fn) {
      listeners.add(fn);
    },
    isEnabled: () => state.enabled,
    flush() {
      if (saveTimer) saveNow();
    },
  };
}
