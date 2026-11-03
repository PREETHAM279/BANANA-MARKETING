# Bengaluru Sales CRM

A private, local-first prospecting CRM for selling a **Social Media Management app** and an **Employee Attendance app** to Bengaluru businesses. It ships with **100 researched, real businesses** (with sources), a dashboard, a searchable directory, full business profiles, a 12-stage pipeline, a "Tomorrow's Outreach" call planner, and a communication centre for calls, WhatsApp and email.

Everything runs on your Mac. Your data stays in one SQLite file on your disk. No cloud hosting, no subscription.

- **Website address:** http://localhost:3100
- **Start:** double-click `start-crm.command`
- **Stop:** double-click `stop-crm.command`
- **Back up:** double-click `backup-crm.command` (also automatic once a day)
- **The 100 businesses:** [RESEARCHED_BUSINESSES.md](RESEARCHED_BUSINESSES.md) · spreadsheet: [data/research-export/bengaluru-100-leads.csv](data/research-export/bengaluru-100-leads.csv)

---

## 1. Get it onto your Mac (one time)

**Option A - with Git (recommended).** Open the Terminal app and run:

```bash
git clone -b claude/eager-rubin-cpjlka https://github.com/PREETHAM279/BANANA-MARKETING.git ~/BANANA-MARKETING
```

If macOS asks to install "command line developer tools", click Install, wait for it to finish, and run the command again.

**Option B - download a ZIP.** On GitHub, switch to the `claude/eager-rubin-cpjlka` branch, click **Code → Download ZIP**, and unzip it (for example into your home folder). Then, once, in Terminal (adjust the folder name if yours differs):

```bash
xattr -dr com.apple.quarantine ~/Downloads/BANANA-MARKETING-claude-eager-rubin-cpjlka
```

That removes the "downloaded from the internet" flag so macOS lets the launchers run.

## 2. Start the CRM (every day)

Open the `bengaluru-crm` folder in Finder and **double-click `start-crm.command`** (or use `Start Bengaluru CRM.command` at the top of the repository).

- **First run:** 2-4 minutes. It checks for Node.js (and downloads a private copy into `.runtime/` if you don't have Node 18.18+), installs the app's packages, creates the database, imports the 100 researched businesses and builds the website. It needs an internet connection.
- **After that:** a few seconds. Your browser opens **http://localhost:3100**.
- You can close the Terminal window; the CRM keeps running in the background until you stop it or restart the Mac.

If double-clicking shows *"cannot be opened because it is from an unidentified developer"*, right-click the file → **Open** → **Open** (only needed once). If it says *"permission denied"*, run `bash start-crm.command` from Terminal inside the folder.

## 3. Restart / stop

- **Restart:** double-click `stop-crm.command`, then `start-crm.command`.
- **After restarting your Mac:** just double-click `start-crm.command` again.
- **Start automatically at login (optional):** System Settings → General → Login Items → **+** → choose `start-crm.command`.
- **Port 3100 busy?** Copy `.env.example` to `.env.local`, set `CRM_PORT=3200`, and start again (the address becomes http://localhost:3200).

## 4. Back up and restore your data

Your whole CRM is the file `data/crm.db` (statuses, notes, calls, messages, follow-ups, uploaded photos are in `data/uploads/`).

- **Automatic:** every time you start the CRM it makes at most one backup per day (keeps the latest 14) in `backups/`.
- **Manual:** double-click `backup-crm.command`, or **Settings & Data → Back up now** in the app (each backup can be downloaded from there too).
- **Off-Mac copy:** copy the `backups` folder to iCloud Drive / Google Drive / a USB stick now and then.
- **Restore:** double-click `restore-backup.command`, pick a backup by number. Your current database is saved as `backups/crm-…-before-restore.db` first.
- **Exports:** Settings & Data (or the directory's CSV button) → **Excel (.xlsx)** with Leads, Activities, Notes, Outreach plan and Sources sheets, **CSV**, or **JSON** (everything).

## 5. What's inside

| Page | What you can do |
|---|---|
| **Dashboard** | Total leads, researched, contacted, calls, WhatsApp, emails, interested, follow-ups pending/overdue, meetings, deals closed, conversion rate; charts by category, location, interest, pipeline stage, 14-day activity and conversion funnel (each chart has a table view). |
| **Directory** | Instant search; filters for category, location (zone + locality), employee estimate, interest, social-media fit, attendance fit, recommended app, contact status and pipeline stage; card or table view; filters are remembered when you open a profile and come back. |
| **Business profile** | Left: photos, address + map, website/social links, Google rating. Middle: overview, owner & decision-makers (with source links), employees & operations, social media analysis, why they're a prospect, best product, interest level, customised pitch, approach, opener, discovery questions, objection handling, sources & verification. Right: Call / WhatsApp / Email, status, follow-up, next action, deal value, meeting, tags, do-not-contact, conversation log, voice notes, notes, full timeline. `[` and `]` jump to the previous/next lead. |
| **Pipeline** | Kanban board of the 12 stages (New Lead → Converted / Not Interested); drag cards or use "Move to". |
| **Tomorrow's Outreach** | All 100 businesses in a recommended calling order grouped into time blocks (offices in the morning, gyms/salons/retail late morning, restaurants/hotels 3-5 PM, no-phone leads last), priority rank, phone, pitch and opener, completion checkbox, per-call notes, follow-up dates, day notes, print, and **Call mode** (one business at a time with one-click outcomes). Pick any date; progress is saved per day. |
| **Follow-ups** | Overdue / today / tomorrow / next 7 days, with call, WhatsApp, snooze and done buttons, plus upcoming meetings. |
| **Communication** | Compose for any business (call script, WhatsApp, email), plus a searchable log of every call, message and meeting. |
| **Settings & Data** | Your name/company/products (used in every script and message), backups, exports, website and Google enrichment, research re-import, integration status. |

Fill in **Settings & Data → Your details** first so openers and messages are signed with your name and company.

## 6. How calling, WhatsApp and email work (honestly)

The CRM never marks something as done just because you clicked a button.

- **Call** opens a `tel:` link. On a Mac this places the call through your iPhone (FaceTime → Settings → "Calls from iPhone", same Apple ID) or FaceTime Audio. The CRM starts a timer and opens **Record conversation**: choose the outcome, type notes, set the next status and follow-up date. Only then is the call logged.
- **WhatsApp** generates a personalised message (intro, follow-up, after-call, meeting confirmation, re-engage), opens WhatsApp Desktop/Web with the text filled in (`wa.me` link), and asks **"Did you send it?"**. It's logged only when you confirm. Bengaluru landlines (080…) are flagged because they rarely have WhatsApp.
  *Fully automatic sending* needs the WhatsApp Business Platform (Meta business verification, paid per conversation, pre-approved templates and recipient opt-in). It isn't suitable for cold outreach, so it isn't built in.
- **Email** generates a subject (with alternatives) and body, then opens your **Mail app** or **Gmail** with everything filled in; confirm afterwards to log it. To send directly from the CRM, configure SMTP (below) - then **Send now** really sends and logs the message ID.
- **Record conversation** also includes an optional **voice note** recorder (your microphone, for in-person meetings or a quick post-call summary). Record people only with their consent. Recordings stay in `data/uploads/`.

Calling businesses on their published numbers is normal B2B practice; please introduce yourself honestly, respect "not interested", and tick **Do not contact** if someone asks you to stop. For high-volume or automated campaigns in India, telemarketing rules (TRAI, DLT registration) apply.

## 7. Optional: Google ratings/photos and real email sending

Copy `.env.example` to `.env.local` (this file is private and never committed), fill in what you want, then stop and start the CRM.

**Google rating, review count and photos (Google Places API - New).** Create a project at https://console.cloud.google.com/, enable **Places API (New)**, create an API key restricted to that API, and add:

```
GOOGLE_PLACES_API_KEY=your-key
```

Then use **Fetch from Google** on a profile, or **Settings & Data → Fetch Google ratings & photos** for all 100. Google charges per request beyond its monthly free usage; 100 lookups is a small amount. Photos are shown with Google's attribution and fetched through your Mac so the key never reaches the browser.

**Send email directly (SMTP).** For Gmail: turn on 2-Step Verification, create an App Password (Google Account → Security → App passwords), then:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=your-16-character-app-password
SMTP_FROM=Your Name <you@gmail.com>
```

**Business photos without any key:** on a profile, **Check website** reads the business's official website from your Mac and picks up the image it publishes for sharing (often a logo or storefront), plus any emails, phone numbers and social links it lists - all labelled "auto-extracted, verify". **Settings & Data → Check all official websites** does it for every business with a website. You can also upload your own photos on any profile.

## 8. The research (what's verified and what isn't)

- 100 real businesses across the requested categories: Restaurants & Cafes 15, Gyms & Fitness 15, Retail & Showrooms 15, Hospitals & Clinics 10, Salons & Spas 10, Education 10, Hotels & Resorts 10, Warehousing & Logistics 5, Real Estate 5, Other Services 5.
- Researched on **3 November 2026** from public sources: official websites, business and trade press (Restaurant India, YourStory, Deccan Herald, The News Minute, Inc42…), tourism boards, RERA and company-registry data, and business directories (LBB, Yappe, LyfSkills, AskLaila, Collegedunia…). Every profile lists its source URLs and a verification note; a closed hospital found during research was excluded.
- **Never invented:** owner/manager names appear only when a cited source names them; phone numbers and emails only when published; decision-maker personal phones/emails are "Not publicly verified" (none were published). Phone numbers that came from personal-contact aggregator sites were deliberately left out.
- **Labelled estimates:** employee counts are shown as *Estimate* with the reasoning (e.g. outlets × typical staffing), unless a source gives a number (e.g. Asha Sweet Center ≈ 900 people per Deccan Herald). The employee filter uses these estimate bands.
- **Assessments, not facts:** interest level, product fit, operational problems and social-media weaknesses are sales hypotheses built from the verified facts - validate them on the call.
- Google ratings and review counts were **not** collected manually (they need Google's API); use the Google Places option above.
- Directory phone numbers go stale. If a number fails, use the **Google Maps** link on the profile and update your notes.

To update or add businesses, edit the JSON files in `data/research/` and use **Settings & Data → Re-import research files** (or just restart). Your CRM data (status, notes, activities, follow-ups) is never overwritten.

## 9. Privacy and security

- The server listens only on `127.0.0.1` (this Mac); other devices on your Wi-Fi can't reach it.
- Requests addressed to any host other than `localhost`/`127.0.0.1` are refused (blocks DNS-rebinding), and changes coming from other websites are rejected (CSRF protection).
- API keys live in `.env.local`, are read only by the server and are never sent to the browser. `.env.local`, the database, uploads, backups and logs are all excluded from Git.

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| Browser says "can't connect" | The CRM isn't running - double-click `start-crm.command`. |
| "Port 3100 is already used" | Set `CRM_PORT=3200` in `.env.local` and start again. |
| Start script fails during install/build | Check `logs/server.log`. Make sure you're online for the first run, then run the start script again. |
| Map on a profile is blank | The map needs internet. Use the "Google Maps" button. |
| Want a clean start | Stop the CRM, move `data/crm.db` somewhere safe, start again - a fresh database with the 100 businesses is created. |

## 11. For developers

Stack: Next.js 15 (App Router) · React 19 · Tailwind CSS 4 · Prisma 6 + SQLite · ExcelJS · Nodemailer · Node 18.18+.

```bash
npm install
npx prisma migrate deploy && node scripts/seed.mjs
npm run dev        # http://localhost:3100 with hot reload
npm run build && npm start
node scripts/research-report.mjs   # regenerate RESEARCHED_BUSINESSES.md and the CSV
```

Layout: `data/research/*.json` (research records with sources) → `scripts/intel.mjs` (scoring, pitch, opener and approach generation) → `scripts/seed.mjs` (safe upsert into SQLite) → `src/app` (pages + API routes) and `src/components`. `tests/e2e.mjs` is a Playwright end-to-end suite (see the header of that file).
