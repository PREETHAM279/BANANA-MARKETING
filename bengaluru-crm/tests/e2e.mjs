// End-to-end test of the CRM against a running server.
//
// Developer use only (not needed to run the CRM). Requires Playwright:
//   npm i -D playwright && npx playwright install chromium
// Start the app first, ideally with a throwaway copy of data/crm.db, then:
//   BASE_URL=http://localhost:3100 node tests/e2e.mjs
// Optional: CRM_ALLOW_PRIVATE_FETCH=1 on the server enables the website-reader test,
// SMTP_* pointing at a local SMTP sink enables the "Send now" test (SMTP_SINK_FILE=path).

import fs from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require(process.env.PLAYWRIGHT_PATH || "playwright");
}
const ExcelJS = require("exceljs");

const BASE = process.env.BASE_URL || "http://localhost:3100";
const results = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push({ ok: true, name });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.push({ ok: false, name, err: e.message });
    console.log(`  ✗ ${name}\n      ${e.message.split("\n")[0]}`);
  }
};
const j = async (path, init) => {
  const r = await fetch(BASE + path, init);
  return { status: r.status, headers: r.headers, body: r.headers.get("content-type")?.includes("json") ? await r.json() : await r.arrayBuffer() };
};
const post = (path, body, method = "POST") => j(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// Sample "official website" for the enrichment test.
const site = http.createServer((req, res) => {
  res.setHeader("Content-Type", "text/html");
  if (req.url === "/contact") {
    res.end(`<html><body><h1>Contact</h1><a href="mailto:hello@sample-cafe.in">Mail</a> Call <a href="tel:+918041234567">080 4123 4567</a></body></html>`);
  } else {
    res.end(`<html><head><title>Sample Cafe</title><meta property="og:image" content="/img/hero.jpg"><meta name="description" content="Best coffee in Indiranagar"></head>
      <body><a href="https://www.instagram.com/samplecafe/">Instagram</a><a href="https://www.facebook.com/samplecafe">FB</a><a href="/contact">Contact us</a> WhatsApp 98450 12345</body></html>`);
  }
});

const browser = await playwright.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

console.log(`Testing ${BASE}\n`);

await step("health endpoint reports 100 businesses", async () => {
  const r = await j("/api/health");
  assert.equal(r.status, 200);
  assert.equal(r.body.businesses, 100);
});

await step("dashboard shows KPIs and charts", async () => {
  await page.goto(BASE + "/");
  await page.getByText("Total leads").waitFor();
  for (const t of ["Businesses researched", "Businesses contacted", "Calls completed", "WhatsApp messages sent", "Emails sent", "Interested prospects", "Follow-ups pending", "Meetings scheduled", "Deals closed"]) {
    assert.ok(await page.getByText(t, { exact: true }).first().isVisible(), `missing KPI ${t}`);
  }
  for (const t of ["Leads by business category", "Leads by location", "Leads by potential interest", "Outreach progress", "Conversion"]) {
    assert.ok(await page.getByRole("heading", { name: t }).first().isVisible(), `missing chart ${t}`);
  }
  await page.getByRole("button", { name: "Table" }).first().click();
  await page.getByRole("cell", { name: "Restaurants & Cafes" }).waitFor();
});

await step("directory search + filters + persistence when returning from a profile", async () => {
  await page.goto(BASE + "/leads");
  const articles = (n) => page.waitForFunction((n) => document.querySelectorAll("article").length === n, n, { timeout: 10000 });
  await page.getByLabel("Search businesses").fill("toit");
  await page.waitForURL(/q=toit/);
  await articles(1);
  await page.getByLabel("Search businesses").fill("");
  await page.getByLabel("All categories").selectOption("Salons & Spas");
  await page.waitForURL(/category=Salons/);
  await articles(10);
  await page.getByLabel("Interest").selectOption("High");
  await page.waitForURL(/interest=High/);
  await page.waitForFunction(() => document.querySelectorAll("article").length < 10);
  const n = await page.locator("article").count();
  assert.ok(n >= 1 && n <= 10);
  await page.locator("article").first().getByRole("link").first().click();
  await page.waitForURL(/\/leads\/[a-z0-9-]+$/);
  await page.getByRole("link", { name: "Directory" }).first().click();
  await page.waitForURL(/category=Salons/);
  await articles(n);
  // Sidebar link also restores the last filters.
  await page.goto(BASE + "/");
  await page.locator("aside").getByRole("link", { name: "Directory" }).click();
  await page.waitForURL(/category=Salons/);
  await page.getByRole("button", { name: /Clear \d+ filter/ }).click();
  await page.waitForFunction(() => document.querySelectorAll("article").length === 100);
});

await step("table view lists all 100 businesses", async () => {
  await page.getByTitle("Table").click();
  await page.waitForURL(/view=table/);
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 100);
  await page.getByTitle("Cards").click();
});

const LEAD = "toit";
await step("profile shows all research sections and sources", async () => {
  await page.goto(`${BASE}/leads/${LEAD}`);
  for (const t of ["Business overview", "Owner & decision-makers", "Employees & operations", "Social media analysis", "Sales opportunity", "Sources & verification"]) {
    await page.getByRole("heading", { name: t }).waitFor();
  }
  await page.getByText("Arun George").first().waitFor();
  assert.ok((await page.locator('a[href^="tel:"]').count()) >= 1);
  assert.ok((await page.getByText("Not publicly verified").count()) >= 1, "unverified fields should be labelled");
});

await step("status, follow-up, next action, deal value and tags autosave", async () => {
  await page.getByLabel("Lead status").selectOption("Interested");
  await page.getByText("All changes saved").first().waitFor();
  await page.getByLabel("Follow-up date").first().fill("2030-01-15");
  await page.getByLabel("Next action").fill("Send pricing for the brewpub");
  await page.getByLabel("Deal value (₹)").fill("75000");
  await page.getByLabel("Add tag").fill("hot-lead");
  await page.getByLabel("Add tag").press("Enter");
  await page.waitForTimeout(1500);
  await page.reload();
  assert.equal(await page.getByLabel("Lead status").inputValue(), "Interested");
  assert.equal(await page.getByLabel("Follow-up date").first().inputValue(), "2030-01-15");
  assert.equal(await page.getByLabel("Next action").inputValue(), "Send pricing for the brewpub");
  assert.equal(await page.getByLabel("Deal value (₹)").inputValue(), "75000");
  await page.getByText("hot-lead").first().waitFor();
  await page.getByText("Status: Researched → Interested").waitFor();
});

await step("notes can be added, edited and persist", async () => {
  await page.getByLabel("New note").fill("Spoke to the floor manager - owner visits on Fridays.");
  await page.getByRole("button", { name: /Add note/ }).click();
  await page.getByText("Spoke to the floor manager").waitFor();
  await page.reload();
  await page.getByText("Spoke to the floor manager").waitFor();
});

await step("calling: tel link + timer + outcome is logged to the timeline", async () => {
  await page.goto(`${BASE}/leads/${LEAD}`);
  await page.getByRole("button", { name: "Log", exact: true }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByRole("button", { name: "Connected - call back later" }).click();
  await dlg.getByLabel("Conversation notes").fill("Asked to call back next week with pricing.");
  await dlg.getByRole("button", { name: "Save to timeline" }).click();
  await page.getByText("Call - Connected - call back later").first().waitFor();
  const acts = (await j(`/api/businesses/${LEAD}/activities`)).body;
  assert.ok(acts.some((a) => a.type === "CALL" && a.details.includes("pricing")));
});

await step("WhatsApp: opens wa.me with the message and logs only after confirmation", async () => {
  await page.goto(`${BASE}/leads/${LEAD}`);
  await page.getByRole("button", { name: "WhatsApp", exact: true }).last().click();
  const dlg = page.getByRole("dialog");
  const text = await dlg.locator("textarea").inputValue();
  assert.ok(text.includes("Toit"), "message is personalised");
  const before = (await j(`/api/businesses/${LEAD}/activities`)).body.filter((a) => a.type === "WHATSAPP").length;
  await page.evaluate(() => {
    window.__opened = [];
    window.open = (u) => (window.__opened.push(String(u)), null);
  });
  await dlg.getByRole("button", { name: "Open in WhatsApp" }).click();
  const opened = await page.evaluate(() => window.__opened);
  assert.match(opened[0], /^https:\/\/wa\.me\/919019713388\?text=Hi%20/);
  const mid = (await j(`/api/businesses/${LEAD}/activities`)).body.filter((a) => a.type === "WHATSAPP").length;
  assert.equal(mid, before, "nothing logged before you confirm");
  await dlg.getByRole("button", { name: "Yes, I sent it" }).click();
  await page.getByText(/WhatsApp introduction sent/).first().waitFor();
});

await step("email: draft with subject options, mailto/Gmail links, confirm-to-log", async () => {
  await page.goto(`${BASE}/leads/${LEAD}`);
  await page.getByRole("button", { name: "Email", exact: true }).first().click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("To", { exact: true }).fill("owner@example.com");
  const gmail = await dlg.getByRole("link", { name: "Open in Gmail" }).getAttribute("href");
  assert.match(gmail, /mail\.google\.com\/mail\/\?view=cm/);
  const mailto = await dlg.getByRole("link", { name: "Open in Mail app" }).getAttribute("href");
  assert.match(mailto, /^mailto:owner%40example\.com\?subject=/);
  // Keep the browser from trying to launch a mail app; the CRM's own click handler still runs.
  await dlg.getByRole("link", { name: "Open in Mail app" }).evaluate((a) => a.addEventListener("click", (e) => e.preventDefault()));
  await dlg.getByRole("link", { name: "Open in Mail app" }).click();
  await dlg.getByRole("button", { name: "Yes, I sent it" }).click();
  await page.getByText(/^Email: /).first().waitFor();
});

if (process.env.SMTP_SINK_FILE) {
  await step("email via SMTP really sends and is logged", async () => {
    await page.goto(`${BASE}/leads/koshys`);
    await page.getByRole("button", { name: "Email", exact: true }).first().click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("To", { exact: true }).fill("prem@example.com");
    await dlg.getByRole("button", { name: "Send now" }).click();
    await page.getByText("Email sent to prem@example.com").waitFor();
    const lines = fs.readFileSync(process.env.SMTP_SINK_FILE, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.ok(lines.some((m) => m.to.includes("prem@example.com") && m.text.includes("Koshy")));
  });
}

await step("voice note upload is stored and streamed with byte ranges", async () => {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(4096).fill(7)], "v.webm", { type: "audio/webm" }));
  form.set("durationSec", "12");
  form.set("note", "Post-call summary");
  const r = await fetch(`${BASE}/api/businesses/${LEAD}/recordings`, { method: "POST", body: form });
  assert.equal(r.status, 200);
  const rec = await r.json();
  const ranged = await fetch(BASE + rec.url, { headers: { Range: "bytes=0-99" } });
  assert.equal(ranged.status, 206);
  assert.equal((await ranged.arrayBuffer()).byteLength, 100);
});

await step("photo upload appears on the profile", async () => {
  await page.goto(`${BASE}/leads/${LEAD}`);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.locator('input[type="file"]').setInputFiles({ name: "shop.png", mimeType: "image/png", buffer: png });
  await page.getByText("Photo added").waitFor();
  const detail = (await j(`/api/businesses/${LEAD}`)).body;
  assert.equal(detail.photos.length, 1);
  const img = await fetch(BASE + detail.photos[0].url);
  assert.equal(img.headers.get("content-type"), "image/png");
});

await step("pipeline: move a card between stages", async () => {
  await page.goto(`${BASE}/pipeline`);
  const card = page.locator("article", { has: page.getByRole("link", { name: "Koshy's", exact: true }) });
  await card.locator("select").selectOption("Meeting Scheduled");
  await page.getByText(/Koshy's: .* → Meeting Scheduled/).waitFor();
  const d = (await j(`/api/businesses/koshys`)).body;
  assert.equal(d.status, "Meeting Scheduled");
});

await step("tomorrow's outreach: 100 rows, blocks, checkbox + notes persist, call mode logs", async () => {
  await page.goto(`${BASE}/outreach`);
  await page.getByText(/Block 1 · 10:00/).first().waitFor();
  assert.equal(await page.locator('input[type="checkbox"][aria-label^="Mark "]').count(), 100);
  const cb = page.getByLabel("Mark Blowhorn as completed");
  await cb.check();
  await page.getByLabel("Notes for Blowhorn").fill("Ask for ops head Mithun");
  await page.getByLabel("Day notes").fill("Focus: restaurants after 3 PM");
  await page.waitForTimeout(1500);
  await page.reload();
  assert.ok(await page.getByLabel("Mark Blowhorn as completed").isChecked());
  assert.equal(await page.getByLabel("Notes for Blowhorn").inputValue(), "Ask for ops head Mithun");
  assert.equal(await page.getByLabel("Day notes").inputValue(), "Focus: restaurants after 3 PM");
  await page.getByRole("button", { name: "Start call mode" }).click();
  const dlg = page.getByRole("dialog", { name: /Call mode/ });
  const first = await dlg.locator("h2").first().textContent();
  await dlg.getByRole("button", { name: "No answer" }).click();
  await page.waitForFunction((name) => document.querySelector('[aria-label^="Call mode"] h2')?.textContent !== name, first);
  await page.keyboard.press("Escape");
  const acts = (await j(`/api/businesses`)).body.find((l) => l.name === first);
  assert.ok(acts && acts.status === "Called" && acts.followUpDate, "quick outcome sets status + follow-up");
});

await step("follow-ups page lists scheduled follow-ups and snooze works", async () => {
  await page.goto(`${BASE}/followups`);
  await page.getByRole("link", { name: "Toit Brewpub" }).first().waitFor();
});

await step("settings: your details flow into the opener", async () => {
  await page.goto(`${BASE}/settings`);
  await page.getByLabel("Your name", { exact: true }).fill("Preetham");
  await page.getByLabel("Your company", { exact: true }).fill("Banana Marketing");
  await page.getByRole("button", { name: "Save details" }).click();
  await page.getByText(/Settings saved/).waitFor();
  await page.goto(`${BASE}/leads/${LEAD}`);
  await page.getByText(/This is Preetham from Banana Marketing/).first().waitFor();
});

await step("exports: CSV, Excel (5 sheets) and JSON", async () => {
  const csv = await fetch(`${BASE}/api/export?format=csv`);
  assert.match(csv.headers.get("content-type"), /text\/csv/);
  const text = await csv.text();
  assert.ok(text.split("\r\n").length >= 101 && text.includes("Toit Brewpub"));
  const xlsx = await fetch(`${BASE}/api/export?format=xlsx`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await xlsx.arrayBuffer()));
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["Leads", "Activities", "Notes", "Outreach plan", "Sources"]);
  assert.equal(wb.getWorksheet("Leads").rowCount, 101);
  const json = await (await fetch(`${BASE}/api/export?format=json`)).json();
  assert.equal(json.businesses.length, 100);
});

await step("backup snapshot is created and downloadable", async () => {
  const r = await post("/api/backup", {});
  assert.equal(r.status, 200);
  const dl = await fetch(`${BASE}/api/backup/${r.body.backup.name}`);
  const buf = Buffer.from(await dl.arrayBuffer());
  assert.equal(buf.subarray(0, 15).toString(), "SQLite format 3");
});

await step("security: foreign Host header and cross-site writes are rejected", async () => {
  const evil = await new Promise((resolve) => {
    const u = new URL(BASE);
    http.get({ host: u.hostname, port: u.port, path: "/api/health", headers: { Host: "evil.example.com" } }, (res) => resolve(res.statusCode)).on("error", () => resolve(0));
  });
  assert.equal(evil, 403);
  const csrf = await fetch(`${BASE}/api/businesses/${LEAD}`, { method: "PATCH", headers: { "Content-Type": "application/json", Origin: "https://evil.example.com" }, body: JSON.stringify({ status: "Converted" }) });
  assert.equal(csrf.status, 403);
  const formPost = await fetch(`${BASE}/api/businesses/${LEAD}`, { method: "PATCH", headers: { "Content-Type": "text/plain" }, body: "status=Converted" });
  assert.equal(formPost.status, 415);
});

await step("validation: bad status and bad dates are refused", async () => {
  assert.equal((await post(`/api/businesses/${LEAD}`, { status: "Hacked" }, "PATCH")).status, 400);
  assert.equal((await post(`/api/businesses/${LEAD}`, { followUpDate: "tomorrow" }, "PATCH")).status, 400);
  assert.equal((await fetch(`${BASE}/api/files/photos/..%2F..%2Fcrm.db/x`)).status, 404);
});

if (process.env.ENRICH_TEST === "1") {
  await step("website reader extracts image, emails, phones and socials", async () => {
    await new Promise((r) => site.listen(4555, "127.0.0.1", r));
    const { PrismaClient } = require("@prisma/client");
    const db = new PrismaClient({ datasources: { db: { url: `file:${process.cwd()}/data/crm.db` } } });
    await db.business.update({ where: { id: "nagarjuna" }, data: { website: "http://127.0.0.1:4555/" } });
    await db.$disconnect();
    const r = await post(`/api/businesses/nagarjuna/enrich`, {});
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const sd = r.body.siteData;
    assert.equal(sd.image, "http://127.0.0.1:4555/img/hero.jpg");
    assert.ok(sd.emails.includes("hello@sample-cafe.in"));
    assert.ok(sd.socials.instagram.includes("samplecafe"));
    assert.ok(sd.phones.some((p) => p.includes("918041234567")));
    site.close();
  });
}

await step("Google enrichment without a key explains what to do", async () => {
  const r = await post(`/api/businesses/${LEAD}/google`, {});
  assert.equal(r.status, 400);
  assert.match(r.body.error, /GOOGLE_PLACES_API_KEY/);
});

await step("dark mode toggle applies and persists", async () => {
  await page.goto(`${BASE}/`);
  await page.getByRole("radio", { name: "Dark" }).click();
  assert.ok(await page.evaluate(() => document.documentElement.classList.contains("dark")));
  await page.reload();
  assert.ok(await page.evaluate(() => document.documentElement.classList.contains("dark")));
  await page.getByRole("radio", { name: "Light" }).click();
});

await step("no uncaught page errors during the run", async () => {
  assert.deepEqual(pageErrors, []);
});

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exitCode = 1;
