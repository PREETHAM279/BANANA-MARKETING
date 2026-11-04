// End-to-end test of Phone access (server.mjs + server/gate.mjs) against a running server.
//
// Developer use only. Start the CRM with `npm start` (not `npm run dev`) on a throwaway copy of the data,
// then run with this Mac's private IP address (the one a phone on the same Wi-Fi would use):
//   PHONE_HOST=192.168.1.5 node tests/phone.mjs
// If the test machine has no private address, start the server with CRM_TEST_PRIVATE_ADDRESSES=<its ip>.
// Leaves Phone access switched OFF when done.

import http from "node:http";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require(process.env.PLAYWRIGHT_PATH || "playwright");
}

const BASE = new URL(process.env.BASE_URL || "http://localhost:3100");
const PORT = Number(BASE.port || 80);
const PHONE = process.env.PHONE_HOST;
if (!PHONE) {
  console.error("Set PHONE_HOST to this machine's private IP address (see the header of this file).");
  process.exit(2);
}
const PHONE_URL = `http://${PHONE}:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push({ ok: true });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.push({ ok: false });
    console.log(`  ✗ ${name}\n      ${String(e.message).split("\n")[0]}`);
  }
};

function req({ host = "127.0.0.1", path = "/", method = "GET", headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host, port: PORT, path, method, headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    r.on("error", reject);
    if (body) r.write(body);
    r.end();
  });
}
const mac = (path, body) => req({ path, method: body ? "POST" : "GET", headers: body ? { "content-type": "application/json", origin: BASE.origin } : {}, body: body ? JSON.stringify(body) : undefined });
const macJson = async (path, body) => JSON.parse((await mac(path, body)).body);
const phone = (path, opts = {}) => req({ host: PHONE, path, ...opts, headers: { host: `${PHONE}:${PORT}`, ...(opts.headers || {}) } });
const form = (fields, extra = {}) => ({ method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: PHONE_URL, ...extra }, body: new URLSearchParams(fields).toString() });
const cookieOf = (res) => String(res.headers["set-cookie"]?.[0] ?? "").split(";")[0];

console.log(`Phone access test: Mac ${BASE.origin}, phone address ${PHONE_URL}\n`);
let pass = "";
let cookie = "";

await step("Mac sees phone access (off by default) and the phone address is closed", async () => {
  const s = await macJson("/__crm/phone/status");
  assert.equal(s.client, "mac");
  if (s.enabled) await macJson("/__crm/phone/enable", { enabled: false });
  await sleep(300);
  await assert.rejects(phone("/"), "nothing listens on the Wi-Fi address while phone access is off");
});

await step("turning it on creates an 8-digit passcode and opens the Wi-Fi address", async () => {
  const s = await macJson("/__crm/phone/enable", { enabled: true });
  assert.equal(s.enabled, true);
  pass = s.newPasscode ?? (await macJson("/__crm/phone/passcode", {})).newPasscode;
  assert.match(pass, /^\d{8}$/);
  for (let i = 0; i < 20; i++) {
    try {
      await phone("/__crm/login");
      break;
    } catch {
      await sleep(150);
    }
  }
  assert.ok(s.addresses.some((a) => a.url === PHONE_URL), `addresses include ${PHONE_URL}`);
});

await step("management is local-only and needs JSON from a local page", async () => {
  assert.equal((await req({ path: "/__crm/phone/enable", method: "POST", headers: { "content-type": "text/plain" }, body: "{}" })).status, 415);
  assert.equal((await req({ path: "/__crm/phone/enable", method: "POST", headers: { "content-type": "application/json", origin: "http://evil.example" }, body: "{}" })).status, 403);
  assert.equal((await req({ path: "/__crm/phone/status", headers: { host: "evil.example:3100" } })).status, 403, "DNS-rebinding host refused");
});

await step("a phone without a session is sent to sign in; API calls get 401", async () => {
  const r = await phone("/leads?x=1", { headers: { accept: "text/html" } });
  assert.equal(r.status, 303);
  assert.equal(r.headers.location, "/__crm/login?next=%2Fleads%3Fx%3D1");
  const a = await phone("/api/businesses");
  assert.equal(a.status, 401);
  assert.equal(JSON.parse(a.body).signIn, "/__crm/login");
  assert.equal((await phone("/_next/static/chunks/webpack.js")).status, 401);
  assert.equal((await phone("/manifest.webmanifest")).status, 200, "home-screen manifest is public");
});

await step("sign-in page: no scripts, strict CSP, numeric keypad", async () => {
  const r = await phone("/__crm/login?next=%2Fleads");
  assert.equal(r.status, 200);
  assert.match(r.headers["content-security-policy"], /default-src 'none'/);
  assert.match(r.body, /inputmode="numeric"/);
  assert.doesNotMatch(r.body, /<script/i);
});

await step("form posts from other origins are blocked", async () => {
  assert.equal((await phone("/__crm/login", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "passcode=1" })).status, 403);
  assert.equal((await phone("/__crm/login", form({ passcode: pass }, { origin: "http://evil.example" }))).status, 403);
  assert.equal((await phone("/__crm/login", form({ passcode: pass }, { origin: "null", "sec-fetch-site": "cross-site" }))).status, 403);
});

await step("wrong passcode is refused; the right one (spaces allowed) signs in with a safe cookie", async () => {
  const bad = await phone("/__crm/login", form({ passcode: "00000001", next: "/leads" }));
  assert.equal(bad.status, 401);
  assert.match(bad.body, /Wrong passcode/);
  const ok = await phone("/__crm/login", form({ passcode: `${pass.slice(0, 4)} ${pass.slice(4)}`, next: "/leads" }, { origin: "null", "sec-fetch-site": "same-origin" }));
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.location, "/leads");
  assert.match(ok.headers["set-cookie"][0], /^crm_phone_session=[\w-]{40,}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=\d+$/);
  cookie = cookieOf(ok);
});

await step("signed-in phone can browse and change data, but not from other origins", async () => {
  assert.equal((await phone("/leads", { headers: { cookie, accept: "text/html" } })).status, 200);
  const list = JSON.parse((await phone("/api/businesses", { headers: { cookie } })).body);
  const id = list[0].id;
  const patch = (origin) => phone(`/api/businesses/${id}`, { method: "PATCH", headers: { cookie, origin, "content-type": "application/json" }, body: JSON.stringify({ nextAction: "Set from phone test" }) });
  assert.equal((await patch(PHONE_URL)).status, 200);
  assert.equal((await patch("http://evil.example")).status, 403);
});

await step("a phone cannot change phone-access settings", async () => {
  const r = await phone("/__crm/phone/enable", { method: "POST", headers: { cookie, origin: PHONE_URL, "content-type": "application/json" }, body: '{"enabled":false}' });
  assert.equal(r.status, 403);
  assert.equal(JSON.parse((await phone("/__crm/phone/status", { headers: { cookie } })).body).client, "phone");
});

await step("path tricks don't reach data without a session", async () => {
  for (const path of ["/icons/../api/businesses", "/icons/..%2fapi/businesses", "/icons/%2e%2e/api/businesses", "/manifest.webmanifest/../api/businesses", "/__crm/login/../../api/businesses"]) {
    const r = await phone(path);
    assert.ok([401, 404].includes(r.status) && !r.body.includes('"priorityRank"'), `${path} -> ${r.status}`);
  }
});

await step("spoofed Host, gate or forwarding headers don't bypass sign-in", async () => {
  assert.equal((await phone("/", { headers: { host: "evil.example:3100", cookie } })).status, 403);
  assert.equal((await phone("/api/businesses", { headers: { "x-crm-gate": "guess", "x-forwarded-for": "127.0.0.1" } })).status, 401);
  assert.equal((await phone("/api/businesses", { headers: { host: `localhost:${PORT}` } })).status, 401);
});

await step("requests through a proxy on the Mac (tailscale serve) need sign-in; public/Funnel visitors are refused", async () => {
  const via = { "x-forwarded-for": "100.101.102.103", "x-forwarded-proto": "https", "x-forwarded-host": "mac.tail1234.ts.net", host: "mac.tail1234.ts.net", "tailscale-user-login": "me@example.com" };
  assert.equal((await req({ path: "/api/businesses", headers: via })).status, 401);
  const lg = await req({ path: "/__crm/login", method: "POST", headers: { ...via, "content-type": "application/x-www-form-urlencoded", origin: "https://mac.tail1234.ts.net" }, body: new URLSearchParams({ passcode: pass }).toString() });
  assert.equal(lg.status, 303);
  assert.match(lg.headers["set-cookie"][0], /; Secure$/, "Secure cookie over https");
  assert.equal((await req({ path: "/", headers: { ...via, "tailscale-funnel-request": "?1" } })).status, 403);
  assert.equal((await req({ path: "/", headers: { ...via, "x-forwarded-for": "8.8.8.8" } })).status, 403);
});

await step("phone browser: QR code link signs in, tab bar works, a call is logged from the phone", async () => {
  const pair = await macJson("/__crm/phone/pair", {});
  const link = pair.links.find((l) => l.url === PHONE_URL)?.link;
  assert.ok(link, "pair link for the Wi-Fi address");
  assert.match(pair.links[0].svg, /^<svg/);
  const browser = await playwright.chromium.launch();
  try {
    const ctx = await browser.newContext({ ...playwright.devices["iPhone 13"] });
    const page = await ctx.newPage();
    await page.goto(link);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(`${PHONE_URL}/`);
    const tabs = page.getByRole("navigation", { name: "Quick navigation" });
    await tabs.getByRole("link", { name: "Leads" }).click();
    await page.waitForURL(/\/leads$/);
    await page.getByRole("button", { name: /^Filters/ }).waitFor();
    await page.locator('a[href^="/leads/"]').first().click();
    const quick = page.getByTestId("quick-actions");
    await quick.getByRole("button", { name: "Log" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: "No answer" }).click();
    await sheet.getByLabel("Conversation notes").fill("Rang from the phone - no answer");
    await sheet.getByRole("button", { name: "Save to timeline" }).click();
    await sheet.waitFor({ state: "detached" });
    const id = page.url().split("/leads/")[1];
    const acts = JSON.parse((await mac(`/api/businesses/${id}/activities`)).body);
    assert.ok(acts.some((a) => a.details?.includes("Rang from the phone")), "the call logged on the phone is on the Mac");
    // a used QR code can't be used again
    const again = await ctx.newPage();
    await again.goto(link);
    await again.getByText("This QR code has expired").waitFor();
    // sign out from Settings
    const before = (await macJson("/__crm/phone/status")).sessions.length;
    await tabs.getByRole("button", { name: "More pages" }).click();
    await page.getByRole("link", { name: "Settings & Data" }).click();
    await page.getByRole("button", { name: "Sign out this phone" }).click();
    await page.waitForURL(/\/__crm\/login\?bye=1/);
    await page.getByText("You're signed out on this device.").waitFor();
    assert.equal((await macJson("/__crm/phone/status")).sessions.length, before - 1, "the phone's session was removed");
  } finally {
    await browser.close();
  }
});

await step("five wrong passcodes pause sign-in, even when guesses arrive all at once; the Mac can lift the pause", async () => {
  const burst = await Promise.all(Array.from({ length: 20 }, (_, i) => phone("/__crm/login", form({ passcode: `98765${String(i).padStart(3, "0")}` }))));
  const wrong = burst.filter((r) => r.status === 401).length;
  assert.equal(wrong, 5, `only 5 guesses are checked before the pause (got ${wrong})`);
  assert.equal(burst.filter((r) => r.status === 429).length, 15);
  const locked = await phone("/__crm/login", form({ passcode: pass }));
  assert.equal(locked.status, 429);
  const s = await macJson("/__crm/phone/status");
  assert.ok(s.security.failedLastHour >= 5);
  await macJson("/__crm/phone/unlock", {});
  assert.equal((await phone("/__crm/login", form({ passcode: pass }))).status, 303);
});

await step("signing out one phone, custom passcode rules, and signing out all phones", async () => {
  const s = await macJson("/__crm/phone/status");
  const target = s.sessions[0];
  await macJson("/__crm/phone/signout", { id: target.id });
  assert.ok(!(await macJson("/__crm/phone/status")).sessions.some((x) => x.id === target.id));
  assert.equal((await mac("/__crm/phone/passcode", { passcode: "123456" })).status, 400);
  assert.equal((await mac("/__crm/phone/passcode", { passcode: "777777" })).status, 400);
  const r = await macJson("/__crm/phone/passcode", { passcode: "mango 2026", signOutAll: true });
  assert.equal(r.sessions.length, 0);
  assert.equal(r.newPasscode, undefined, "a passcode you chose is never echoed back");
  assert.equal((await phone("/api/businesses", { headers: { cookie } })).status, 401, "old sessions are gone");
  assert.equal((await phone("/__crm/login", form({ passcode: "mango2026" }))).status, 303);
});

await step("turning it off closes the Wi-Fi address and refuses proxied visitors", async () => {
  await macJson("/__crm/phone/enable", { enabled: false });
  await sleep(300);
  await assert.rejects(phone("/"));
  const r = await req({ path: "/", headers: { "x-forwarded-for": "100.101.102.103", host: "mac.tail1234.ts.net" } });
  assert.equal(r.status, 403);
  assert.match(r.body, /Phone access is off/);
});

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} phone-access checks passed`);
process.exit(failed ? 1 : 0);
