// Sales-intelligence generator.
//
// Turns a researched business record (data/research/*.json) into the research
// fields stored in the database: fit scores, priority, pitch, opener, approach,
// operational problems, social-media analysis and call timing.
//
// Rules:
//  - Only facts present in the research record are referenced (names, branches,
//    facts, contacts). Nothing is invented.
//  - Product claims stay within the two products as described by the user:
//    A) Social Media Management (content planning/management, performance
//       tracking, growth and customer engagement)
//    B) Employee Attendance Management (attendance tracking, clock-in/clock-out,
//       employee records, attendance reports, management monitoring).
//  - {{yourName}} / {{yourCompany}} placeholders are filled in by the app from
//    Settings, so scripts stay personal to the salesperson.

export const CATEGORIES = [
  "Restaurants & Cafes",
  "Gyms & Fitness",
  "Retail & Showrooms",
  "Hospitals & Clinics",
  "Salons & Spas",
  "Education",
  "Hotels & Resorts",
  "Warehousing & Logistics",
  "Real Estate",
  "Other Services",
];

export const CALL_BLOCKS = {
  1: { label: "Block 1 · 10:00–11:30 AM", hint: "Offices: schools, hospitals (admin), real estate, logistics" },
  2: { label: "Block 2 · 11:30 AM–1:00 PM", hint: "Gyms, salons, retail and service businesses" },
  3: { label: "Block 3 · 3:00–5:00 PM", hint: "Restaurants and hotels (between service rushes)" },
  4: { label: "Block 4 · 5:00–6:30 PM", hint: "No public phone: email, WhatsApp, website forms, LinkedIn" },
};

const PLAYBOOKS = {
  "Restaurants & Cafes": {
    socialHook: "Diners decide where to eat from what they see on Instagram and Google, so consistent food content directly drives footfall.",
    plural: "restaurant and cafe brands",
    unit: "outlet",
    units: "outlets",
    staff: "kitchen, service and delivery staff",
    bestTime: "3:00–5:00 PM, between lunch and dinner service (avoid 12:00–2:30 PM and after 7 PM)",
    callBlock: 3,
    decisionRole: "the owner/founder or the operations head",
    socialBase: "High",
    shiftHeavy: true,
    problems: [
      "Shift-based kitchen and service teams across outlets make manual attendance registers slow to compile and easy to dispute at salary time.",
      "High staff turnover means new joiners constantly need to be added to records and tracked from day one.",
      "Late arrivals just before peak hours hurt food prep and table turnaround.",
      "Outlet managers juggle operations with social media, so posting becomes irregular.",
      "New dishes, offers and events are not promoted consistently across outlets and platforms.",
    ],
    socialGap: "Food brands need a steady weekly rhythm of dish photos, reels and offers; without a calendar, posting depends on whoever is free.",
    discovery: [
      "How do you track attendance across your outlets today - register, biometric or WhatsApp?",
      "How long does it take each month to compile attendance for salaries?",
      "Who looks after Instagram and Google posts, and how often do you post?",
      "Which outlet or dish would you most like to push this month?",
    ],
    objections: [
      { q: "We already have a biometric machine.", a: "That captures entry at one door. Our app adds clock-in/clock-out for every outlet, one set of employee records and ready attendance reports, so nobody compiles data machine by machine." },
      { q: "An agency handles our social media.", a: "The content calendar and performance tracking make the agency's work visible to you and keep every outlet consistent." },
      { q: "Our staff are not tech-savvy.", a: "Clock-in and clock-out are single taps; we help you onboard the team in the first week." },
    ],
  },
  "Gyms & Fitness": {
    socialHook: "People pick a gym after seeing transformations, class schedules and offers on Instagram.",
    plural: "gyms and fitness studios",
    unit: "centre",
    units: "centres",
    staff: "trainers, front-desk and housekeeping staff",
    bestTime: "11:00 AM–4:00 PM, after the morning rush and before the evening peak",
    callBlock: 2,
    decisionRole: "the owner/franchise partner or the centre manager",
    socialBase: "High",
    shiftHeavy: true,
    problems: [
      "Trainers work split morning/evening shifts, so hours are hard to track on paper.",
      "Long opening hours need reliable front-desk and floor coverage every day.",
      "Trainer payouts and incentives depend on accurate attendance records.",
      "Member acquisition depends on consistent transformation stories, class schedules and offers on Instagram.",
      "Seasonal campaigns (New Year, summer, festive offers) tend to be planned at the last minute.",
    ],
    socialGap: "Fitness brands win members through regular transformation stories and class schedules; irregular posting shows up directly in walk-ins.",
    discovery: [
      "How do you track trainer and staff attendance across shifts right now?",
      "How are trainer hours and incentives calculated at month end?",
      "Who plans your Instagram content and offers?",
      "What is your biggest member-acquisition push in the next 60 days?",
    ],
    objections: [
      { q: "Our gym software already tracks members.", a: "Member check-in is different from staff attendance. We cover your team: clock-in/clock-out, employee records and attendance reports." },
      { q: "We post on Instagram ourselves.", a: "The calendar lets you plan a month in one sitting and the performance view shows which posts bring enquiries." },
      { q: "We are a franchise - head office decides tools.", a: "Many tools are left to the franchise partner; the attendance reports also make it easier to share data with head office." },
    ],
  },
  "Retail & Showrooms": {
    socialHook: "Shoppers check Instagram for new arrivals and festive collections before they visit.",
    plural: "retail stores and showrooms",
    unit: "store",
    units: "stores",
    staff: "sales staff, cashiers and back-office staff",
    bestTime: "11:00 AM–1:00 PM on weekdays, before afternoon footfall (avoid weekends and festival days)",
    callBlock: 2,
    decisionRole: "the owner/director or the store operations head",
    socialBase: "High",
    shiftHeavy: false,
    problems: [
      "Sales-staff rosters for weekends, sales and festive peaks are managed manually.",
      "Incentives and commissions need accurate attendance records.",
      "With several stores, managers send attendance on WhatsApp or paper at month end.",
      "Festive, wedding-season and new-arrival campaigns need planned content.",
      "Product photos and reels are posted irregularly, so new stock is not seen.",
    ],
    socialGap: "Retail demand peaks around festivals and wedding seasons; without a planned calendar, campaigns start late.",
    discovery: [
      "How do store managers report attendance today?",
      "Do sales incentives depend on attendance?",
      "Which season matters most for you - festive, wedding or year-end?",
      "Who handles your social media and product photography?",
    ],
    objections: [
      { q: "We are a traditional business; customers come by word of mouth.", a: "Word of mouth now happens on Instagram and WhatsApp; a simple calendar keeps your new arrivals in front of past customers." },
      { q: "We already use a billing/ERP system.", a: "Billing tracks sales, not staff attendance; our reports sit alongside your ERP without replacing it." },
    ],
  },
  "Hospitals & Clinics": {
    socialHook: "Patients look for doctor-led information and reviews online before they book.",
    plural: "hospitals and clinic chains",
    unit: "centre",
    units: "centres",
    staff: "nurses, technicians, front-office and support staff",
    bestTime: "10:30 AM–12:30 PM for hospital admin offices; clinics are easier at 2:30–4:30 PM after the morning OPD",
    callBlock: 1,
    decisionRole: "the administrator, HR head or marketing head (founder-doctor for clinic chains)",
    socialBase: "Medium",
    shiftHeavy: true,
    problems: [
      "24x7 shift rosters for nursing and support staff are hard to track manually.",
      "Attendance records matter for audits, accreditation and payroll.",
      "Multi-branch teams report attendance through different registers or devices.",
      "Patients research doctors and reviews online; regular educational content builds trust.",
      "Health-awareness days, camps and new services are not promoted consistently.",
    ],
    socialGap: "Healthcare audiences respond to doctor-led education and patient-trust content; a planned calendar keeps it compliant and consistent.",
    discovery: [
      "How are shift attendance and overtime recorded for nursing and support staff?",
      "How long does month-end attendance reconciliation take for HR?",
      "Who manages patient education and social media today?",
      "Are you opening new centres or services this year?",
    ],
    objections: [
      { q: "We have an HMS/HRMS already.", a: "If attendance still comes from registers or separate devices, our clock-in/clock-out and reports can feed your HR process instead of replacing your HMS." },
      { q: "Healthcare marketing is sensitive.", a: "The calendar lets you plan and approve every post in advance, and performance tracking shows what patients engage with." },
    ],
  },
  "Salons & Spas": {
    socialHook: "Clients choose salons from before-and-after posts and offers on Instagram.",
    plural: "salon and spa chains",
    unit: "salon",
    units: "salons",
    staff: "stylists, therapists and front-desk staff",
    bestTime: "11:00 AM–1:00 PM on weekdays, before afternoon appointments (avoid evenings and weekends)",
    callBlock: 2,
    decisionRole: "the owner/founder or the operations head",
    socialBase: "High",
    shiftHeavy: true,
    problems: [
      "Stylists and therapists work rotational shifts and weekly offs that are tracked on paper or WhatsApp.",
      "Commissions and incentives depend on accurate attendance.",
      "Late or absent staff lead to rescheduled appointments.",
      "Instagram is the main discovery channel; before/after content needs consistency.",
      "Festive and bridal-season campaigns need planning across branches.",
    ],
    socialGap: "Beauty clients choose salons from Instagram; inconsistent before/after posts and offers mean lost bookings.",
    discovery: [
      "How do you track stylist and therapist attendance and weekly offs?",
      "How are commissions calculated each month?",
      "Who creates your Instagram content and how often do you post?",
      "Which service or offer do you want to promote next?",
    ],
    objections: [
      { q: "Our salon software handles appointments.", a: "Appointments and attendance are different; we add staff clock-in/clock-out, employee records and attendance reports." },
      { q: "We post on Instagram already.", a: "The calendar and performance tracking help you post consistently for every salon and see which offers convert." },
    ],
  },
  Education: {
    socialHook: "Parents and students judge an institute by what they see online - events, results and campus life.",
    plural: "schools and education institutes",
    unit: "campus",
    units: "campuses",
    staff: "teachers, faculty and support staff",
    bestTime: "10:00 AM–12:30 PM on weekdays (avoid assembly, exam weeks and evening class hours)",
    callBlock: 1,
    decisionRole: "the principal, administrator or founder-director",
    socialBase: "High",
    shiftHeavy: false,
    problems: [
      "Teacher and staff attendance across campuses or batches is recorded manually.",
      "Part-time and visiting faculty hours need accurate records for payment.",
      "Substitutions for absent teachers are arranged at the last minute.",
      "Admissions-season content, results and events need a planned calendar.",
      "Parents expect regular updates on social channels.",
    ],
    socialGap: "Admissions decisions are influenced by what parents see online; events, results and campus life need a steady posting plan.",
    discovery: [
      "How is teacher and staff attendance recorded today?",
      "How are part-time or visiting faculty hours calculated?",
      "When does your admissions campaign start, and who runs social media?",
      "How do you share events and achievements with parents?",
    ],
    objections: [
      { q: "Our ERP has an attendance module.", a: "If staff still sign registers, our one-tap clock-in/clock-out and reports can complement the ERP." },
      { q: "We rely on referrals for admissions.", a: "Referrals check your social pages first; a consistent calendar supports the referral story." },
    ],
  },
  "Hotels & Resorts": {
    socialHook: "Guests and event planners decide on direct bookings from what they see on Instagram.",
    plural: "hotels and resorts",
    unit: "property",
    units: "properties",
    staff: "housekeeping, F&B, front-office and maintenance staff",
    bestTime: "11:00 AM–12:30 PM or 3:00–5:00 PM, between check-out and check-in rushes",
    callBlock: 3,
    decisionRole: "the General Manager, HR manager or sales & marketing head",
    socialBase: "High",
    shiftHeavy: true,
    problems: [
      "Round-the-clock shifts across departments make attendance compilation slow.",
      "Casual and contract banquet staff for events need quick onboarding and tracking.",
      "Overtime and shift swaps lead to payroll disputes.",
      "OTA commissions push hotels to win direct bookings through their own social channels.",
      "Banquet, F&B and weekend offers are promoted inconsistently.",
    ],
    socialGap: "Direct bookings and event enquiries depend on a consistent visual presence; most properties post in bursts around events.",
    discovery: [
      "How do departments report attendance and overtime today?",
      "How do you manage casual staff for banquets and events?",
      "What share of bookings come direct versus OTAs?",
      "Who plans your social media and F&B promotions?",
    ],
    objections: [
      { q: "Our PMS covers operations.", a: "The PMS runs rooms; our attendance reports cover your people across all departments and shifts." },
      { q: "We focus on OTAs.", a: "A planned social calendar helps you win direct bookings and events without paying OTA commission." },
    ],
  },
  "Warehousing & Logistics": {
    socialHook: "B2B buyers check LinkedIn before shortlisting logistics partners.",
    plural: "logistics and warehousing companies",
    unit: "site",
    units: "sites",
    staff: "warehouse associates, supervisors, drivers and field staff",
    bestTime: "10:00–11:30 AM (after the morning dispatch) or 3:00–5:00 PM",
    callBlock: 1,
    decisionRole: "the operations head, HR head or founder",
    socialBase: "Low",
    shiftHeavy: true,
    problems: [
      "Multi-shift warehouse teams and contract labour are tracked on registers or spreadsheets.",
      "Overtime and shift changes need accurate records for payroll and labour compliance.",
      "Supervisors and field staff work across sites, so managers lack one attendance view.",
      "B2B visibility on LinkedIn depends on consistent posting about capabilities and wins.",
    ],
    socialGap: "B2B buyers check LinkedIn; capability updates and customer wins are rarely posted on a plan.",
    discovery: [
      "How do you record attendance for each shift and for contract workers?",
      "How much time goes into overtime and attendance reconciliation each month?",
      "Do supervisors manage multiple sites?",
      "Who handles LinkedIn and company updates?",
    ],
    objections: [
      { q: "Our contractor manages the labour attendance.", a: "Our reports give you an independent record per site and shift, which helps when you reconcile contractor bills." },
      { q: "We built our own tech.", a: "Most in-house tools focus on shipments; attendance and employee records are usually still manual - worth a quick comparison." },
    ],
  },
  "Real Estate": {
    socialHook: "Home buyers shortlist projects on Instagram and YouTube long before a site visit, and every project needs fresh content between launches.",
    plural: "real estate developers",
    unit: "project site",
    units: "project sites",
    staff: "sales executives, site engineers and supervisors",
    bestTime: "10:30 AM–12:30 PM on weekdays (sales teams run site visits on weekends)",
    callBlock: 1,
    decisionRole: "the founder/MD, marketing head or HR head",
    socialBase: "High",
    shiftHeavy: false,
    problems: [
      "Sales and site teams work across multiple project sites, making attendance hard to verify.",
      "Site engineers and supervisors report attendance informally.",
      "Project launches and site-visit campaigns need planned, consistent content.",
      "Each project needs its own content stream while staying on-brand.",
    ],
    socialGap: "Project launches live or die on consistent content and lead follow-up; posting usually spikes at launch and then goes quiet.",
    discovery: [
      "How do you confirm attendance for sales staff at site offices?",
      "How do site engineers and supervisors report attendance?",
      "Which project launch or sales push is next?",
      "Who manages social media for each project?",
    ],
    objections: [
      { q: "Our agency runs launch campaigns.", a: "The calendar and performance tracking keep every project consistent between launches and show the agency's results." },
      { q: "We use a CRM for leads.", a: "We do not replace your lead CRM; we cover content planning and staff attendance around it." },
    ],
  },
  "Other Services": {
    socialHook: "Customers check reviews and recent posts before they call.",
    plural: "service businesses",
    unit: "location",
    units: "locations",
    staff: "front-line and support staff",
    bestTime: "11:00 AM–1:00 PM on weekdays",
    callBlock: 2,
    decisionRole: "the founder or operations head",
    socialBase: "Medium",
    shiftHeavy: false,
    problems: [
      "Teams spread across locations or customer sites report attendance informally.",
      "Month-end attendance reconciliation takes managers' time.",
      "Customer stories and offers are not posted on a regular plan.",
      "Different locations post inconsistently, diluting the brand.",
    ],
    socialGap: "Service brands grow on reviews and customer stories; without a calendar, posting is sporadic.",
    discovery: [
      "How do your teams record attendance today?",
      "How many people work across your locations or customer sites?",
      "Who looks after social media?",
      "What growth target do you have for the next quarter?",
    ],
    objections: [
      { q: "We are too busy to change systems.", a: "Setup takes days, not weeks, and removes month-end manual work." },
    ],
  },
};

// Sub-category overrides for the mixed "Other Services" group and a few special cases.
function socialBaseFor(r, pb) {
  const s = `${r.subcategory} ${r.description}`.toLowerCase();
  if (r.category === "Other Services") {
    if (/interior|veterinary|pet|car service/.test(s)) return "High";
    return "Medium";
  }
  if (r.category === "Hospitals & Clinics" && /dermatolog|aesthetic|skin|physio|fertility|eye|women and children/.test(s)) return "High";
  if (r.category === "Warehousing & Logistics" && /relocation|packers|movers/.test(s)) return "Medium";
  return pb.socialBase;
}

// ---------- helpers ----------

const ORDER = { Low: 0, Medium: 1, High: 2 };
const minLevel = (a, b) => (ORDER[a] <= ORDER[b] ? a : b);

export function parseRange(text) {
  if (!text) return null;
  const nums = String(text).replace(/,/g, "").match(/\d+/g);
  if (!nums) return null;
  const vals = nums.map(Number).filter((n) => n > 0 && n < 100000);
  if (!vals.length) return null;
  const lo = vals[0];
  const hi = vals.length > 1 ? vals[1] : vals[0];
  return { lo, hi, mid: (lo + hi) / 2 };
}

export function employeeBand(mid) {
  if (mid == null) return "Unknown";
  if (mid <= 10) return "1–10";
  if (mid <= 50) return "11–50";
  if (mid <= 200) return "51–200";
  if (mid <= 500) return "201–500";
  return "500+";
}

const ZONES = [
  ["Central", ["mg road", "church street", "residency road", "st. mark", "st mark", "lavelle", "vittal mallya", "ashok nagar", "raj bhavan", "crescent road", "high grounds", "brigade road", "cubbon", "shanthala", "richmond", "magrath", "vasanth nagar", "seshadripuram", "kamaraj", "shivajinagar", "shivaji nagar", "commercial street", "infantry", "victoria road", "cbd", "lalbagh", "mavalli", "shama rao", "langford"]],
  ["North", ["sadashiva", "malleshwaram", "malleswaram", "yelahanka", "hebbal", "kalyan nagar", "hrbr", "hbr layout", "hennur", "devanahalli", "hesaraghatta", "jakkur", "new bel road", "rt nagar", "r t nagar", "banaswadi", "kothanur", "thanisandra", "sahakar", "mathikere", "vidyaranyapura", "frazer town", "fraser town", "horamavu", "kumara park", "sankey"]],
  ["South", ["jayanagar", "jp nagar", "j.p nagar", "j p nagar", "basavanagudi", "gandhi bazaar", "bannerghatta", "btm", "koramangala", "hsr", "electronic city", "kanakapura", "banashankari", "kumaraswamy", "hulimavu", "begur", "bommasandra", "uttarahalli", "shankarapuram", "kaggalipura"]],
  ["East", ["indiranagar", "whitefield", "marathahalli", "bellandur", "sarjapur", "hoodi", "kr puram", "k r puram", "mahadevapura", "domlur", "old airport", "brookefield", "varthur", "panathur", "kadubisanahalli", "devarabisanahalli", "outer ring road", "itpl", "kundanahalli", "bhattarahalli", "hoskote", "old madras road", "ulsoor", "halasuru", "kagadasapura", "chikkavaderapura", "dommasandra", "budigere", "hemmandanahalli"]],
  ["West", ["rajajinagar", "vijayanagar", "basaveshwar", "nagarbhavi", "yeshwanthpur", "yeswanthpur", "nelamangala", "tumkur", "magadi", "rr nagar", "kengeri", "gandhinagar", "gandhi nagar", "raja industrial", "industrial suburb", "govindaraja", "dasarahalli", "jalahalli"]],
];

export function localityOf(area) {
  if (!area) return "Bengaluru";
  let a = String(area).split(" / ")[0];
  a = a.replace(/\s*\(.*?\)\s*/g, " ").trim();
  return a || "Bengaluru";
}

export function zoneOf(area, address) {
  const loc = localityOf(area).toLowerCase();
  for (const [zone, keys] of ZONES) if (keys.some((k) => loc.includes(k))) return zone;
  const hay = `${area || ""}`.toLowerCase();
  for (const [zone, keys] of ZONES) if (keys.some((k) => hay.includes(k))) return zone;
  const hay2 = `${address || ""}`.toLowerCase();
  for (const [zone, keys] of ZONES) if (keys.some((k) => hay2.includes(k))) return zone;
  return "Citywide / Multiple";
}

// Numbers in the research files are written "+91 80 XXXX XXXX" for Bengaluru
// landlines and "+91 XXXXX XXXXX" for mobiles. Mobiles can also start with 80,
// so the spacing convention (or an explicit "type") decides.
export function phoneType(p) {
  if (p && (p.type === "mobile" || p.type === "landline")) return p.type;
  const raw = String(p?.number ?? p ?? "").trim();
  if (/^\+91[\s-]*80[\s-]+\d{4}[\s-]*\d{4}$/.test(raw) || /^0?80[\s-]+\d{4}[\s-]*\d{4}$/.test(raw)) return "landline";
  const d = raw.replace(/\D/g, "");
  const local = d.startsWith("91") && d.length === 12 ? d.slice(2) : d.replace(/^0/, "");
  return local.length === 10 && /^[6-9]/.test(local) ? "mobile" : "landline";
}

export function isIndianMobile(p) {
  return phoneType(p) === "mobile";
}

function greetName(person) {
  if (!person) return null;
  return person.name.replace(/^Coach\s+/i, "").trim();
}

function sentence(text) {
  const t = String(text || "").trim();
  if (!t) return "";
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function lowerFirst(text) {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

// ---------- main ----------

export function buildIntel(r, researchDate) {
  const pb = PLAYBOOKS[r.category] || PLAYBOOKS["Other Services"];
  const people = Array.isArray(r.people) ? r.people : [];
  const owner = people.find((p) => p.type === "owner") || null;
  const manager = people.find((p) => p.type === "manager") || null;
  const phones = (Array.isArray(r.phones) ? r.phones : []).map((p) => ({ ...p, type: phoneType(p) }));
  const emails = Array.isArray(r.emails) ? r.emails : [];
  const facts = Array.isArray(r.facts) ? r.facts : [];
  const n = r.branchCount && r.branchCount > 1 ? r.branchCount : null;
  const est = parseRange(r.employees?.verified) || parseRange(r.employees?.estimate);
  const mid = est ? est.mid : null;

  // ---- fit scores ----
  let attendanceFit = "Medium";
  if ((mid != null && mid >= 50) || (n && n >= 3) || (pb.shiftHeavy && mid != null && mid >= 30)) attendanceFit = "High";
  else if (mid != null && mid < 12) attendanceFit = "Low";
  let socialFit = socialBaseFor(r, pb);
  if (r.product === "Attendance") socialFit = minLevel(socialFit, "Medium");
  if (r.product === "Social Media") attendanceFit = minLevel(attendanceFit, "Medium");
  if (r.product === "Social Media") socialFit = "High";
  if (r.product === "Attendance") attendanceFit = "High";

  const scaleText = n ? `${n} ${pb.units}` : `one ${pb.unit}`;
  const estText = r.employees?.verified
    ? `${r.employees.verified}`
    : r.employees?.estimate
      ? `an estimated ${r.employees.estimate} people (estimate)`
      : "an unverified team size";

  const attendanceFitReason =
    attendanceFit === "High"
      ? `${scaleText} with ${estText}; ${pb.staff} work in shifts, so manual attendance does not scale.`
      : attendanceFit === "Medium"
        ? `${scaleText} with ${estText}; attendance is manageable manually but reports and records would save time.`
        : `Small team (${estText}); attendance is a lower priority than social media.`;
  const socialFitReason =
    socialFit === "High"
      ? `Customer-facing ${pb.unit === "site" ? "B2B" : "consumer"} brand where consistent content drives enquiries${n ? ` across ${n} ${pb.units}` : ""}.`
      : socialFit === "Medium"
        ? "Social media supports reputation and hiring, but is not the main sales channel."
        : "Mostly B2B; social media matters mainly on LinkedIn.";

  // ---- interest reasoning ----
  const interestBits = [];
  if (n) interestBits.push(`${n} ${pb.units}`);
  if (r.employees?.verified) interestBits.push(r.employees.verified);
  else if (r.employees?.estimate) interestBits.push(`~${r.employees.estimate} staff (estimate)`);
  if (people.length) interestBits.push("decision-maker identified");
  if (phones.length) interestBits.push("public phone available");
  if (r.interest === "Low") interestBits.push("large organisation - likely has existing systems and a longer buying process");
  const interestReason = `${r.interest}: ${interestBits.join(", ") || "limited public information"}.`;

  // ---- product recommendation ----
  const productReason =
    r.product === "Both"
      ? `Both apps fit: ${lowerFirst(pb.problems[0])} At the same time, ${lowerFirst(pb.socialGap)}`
      : r.product === "Attendance"
        ? `Lead with Attendance: ${lowerFirst(pb.problems[0])} Social media is likely handled already or less critical.`
        : `Lead with Social Media: ${lowerFirst(pb.socialGap)} The team is small enough that attendance is secondary.`;

  // ---- why prospect ----
  const whyProspect = [
    `${r.name} - ${r.subcategory || r.category}, based in ${r.locality || localityOf(r.area)}.${n ? ` It operates ${n} ${pb.units}.` : ""}`,
    facts[0] ? sentence(facts[0]) : "",
    r.product === "Social Media"
      ? "Its growth depends on staying visible to customers online, which is exactly what the social media app is built for."
      : r.product === "Attendance"
        ? `With ${pb.staff} working in shifts, digital clock-in/clock-out and attendance reports remove manual work for managers.`
        : `It combines shift-based ${pb.staff} (attendance) with a customer-facing brand that needs consistent content (social media).`,
  ]
    .filter(Boolean)
    .join(" ");

  // ---- operational problems (category playbook, scaled to the business) ----
  const operationalProblems = pb.problems.slice(0, r.product === "Social Media" ? 5 : 5);

  // ---- social media analysis ----
  const socialWeaknesses = [];
  if (!r.website) socialWeaknesses.push("No official website surfaced in research - discovery likely depends on aggregators, listings and word of mouth.");
  if (!r.instagram) socialWeaknesses.push("Official Instagram handle not verified in research - check whether they post regularly before calling.");
  if (n && n >= 3) socialWeaknesses.push(`${n} ${pb.units} - high risk of inconsistent posting and offers across locations.`);
  socialWeaknesses.push(pb.socialGap);
  const socialPresence = [
    r.socialObserved ? sentence(r.socialObserved) : "",
    `Website: ${r.website ? "found (" + r.website + ")" : "not found"}. Instagram: ${r.instagram ? "found (" + r.instagram + ")" : "not verified"}. Facebook: ${r.facebook ? "found" : "not verified"}. LinkedIn: ${r.linkedin ? "found" : "not verified"}.`,
    "Follower counts and posting frequency were not verified - check the profiles before the call.",
  ]
    .filter(Boolean)
    .join(" ");

  // ---- pitch ----
  const ownerName = greetName(owner);
  const hook = r.hook ? sentence(r.hook) : `I came across ${r.name} in ${r.area || "Bengaluru"}.`;
  const attendanceLine = `an attendance app that gives your ${pb.staff} one-tap clock-in and clock-out, keeps every employee record in one place and gives you attendance reports${n ? ` for each of your ${n} ${pb.units}` : ""} - no more registers or WhatsApp roll-calls`;
  const socialLine = `a social media management app to plan your content calendar${n ? ` for all ${n} ${pb.units}` : ""}, manage posts in one place and track which posts actually bring customer engagement`;
  let pitch;
  if (r.product === "Both") {
    pitch = `${hook} ${n ? `Running ${n} ${pb.units}` : `Running a busy ${pb.unit}`} usually means two recurring headaches: compiling staff attendance every month and keeping social media consistent. We offer two simple tools: ${attendanceLine}; and ${socialLine}. Could I show you a 15-minute demo this week using an example from your own ${pb.unit}?`;
  } else if (r.product === "Attendance") {
    pitch = `${hook} ${n ? `With ${n} ${pb.units}` : "With shift-based teams"}, attendance usually ends up on registers, devices and WhatsApp messages that someone reconciles at month end. We offer ${attendanceLine}. Managers get a live view of who is in, late or absent. Could I show you a 15-minute demo this week?`;
  } else {
    pitch = `${hook} ${pb.socialHook} Keeping that consistent is hard when the team is busy running the business. We offer ${socialLine}, so you post consistently and know what works. Could I show you a 15-minute demo with a sample calendar for ${r.name}?`;
  }

  // ---- opener ----
  const greeting = ownerName ? `Hi, am I speaking with ${ownerName}?` : `Hi, is this ${r.name}? Could I speak with ${pb.decisionRole}?`;
  const valueShort =
    r.product === "Social Media"
      ? "plan and manage their social media in one place"
      : r.product === "Attendance"
        ? "replace manual attendance registers with simple digital clock-in and reports"
        : "with staff attendance and social media - two things that eat managers' time";
  const opener = `${greeting} This is {{yourName}} from {{yourCompany}}. ${r.hook ? sentence(r.hook) + " " : ""}We help ${pb.plural} in Bengaluru ${r.product === "Both" ? "" : "to "}${valueShort}. Do you have two minutes?`;

  // ---- approach ----
  const steps = [];
  const mobile = phones.find((p) => p.type === "mobile");
  if (phones.length) {
    steps.push(`Call ${phones[0].number} at ${pb.bestTime}. Number source: ${phones[0].label}.`);
    steps.push(`Ask for ${owner ? `${owner.name} - ${owner.role}` : manager ? `${manager.name} - ${manager.role}` : pb.decisionRole}; if you reach a front desk, ask who handles staff attendance and social media.`);
  } else {
    steps.push("No public phone was verified in research - open the Google Maps link to find the listed number, or start with the channels below.");
  }
  if (emails.length) steps.push(`Email ${emails[0].email} with a short intro and a 15-minute demo request.`);
  else if (r.website) steps.push(`Use the contact form or enquiry number on ${r.website}.`);
  if (mobile) steps.push(`Follow up on WhatsApp at ${mobile.number} with the generated intro message (only after a call or if the number is published for enquiries).`);
  if (r.linkedin) steps.push("Connect with the founders/managers on LinkedIn and reference the call.");
  steps.push(`If interested, offer an on-site demo at their ${localityOf(r.area)} location and set a follow-up date in the CRM.`);
  const approach = steps.join("\n");

  // ---- management structure ----
  const managementStructure = people.length
    ? `Publicly identified: ${people.map((p) => `${p.name} - ${p.role}`).join("; ")}. Outlet/branch managers are not publicly listed.`
    : "Not publicly verified - ask for the owner, operations head or HR on the first call.";

  // ---- priority score ----
  let score = { High: 40, Medium: 25, Low: 10 }[r.interest] ?? 20;
  score += r.product === "Both" ? 15 : 8;
  if (phones.length) score += 15;
  if (mobile) score += 3;
  if (emails.length) score += 4;
  if (people.length) score += 10;
  if (n) score += n >= 5 ? 8 : 5;
  else score += 2;
  if (r.confidence === "High") score += 5;
  score = Math.min(100, score);

  const callBlock = phones.length ? pb.callBlock : 4;
  const est2 = r.employees || {};

  return {
    id: r.id,
    name: r.name,
    category: r.category,
    subcategory: r.subcategory || "",
    area: r.area || "",
    locality: r.locality || localityOf(r.area),
    zone: r.zone || zoneOf(r.area, r.address),
    address: r.address || "",
    mapsQuery: `${r.name}, ${r.address || r.area}, Bengaluru`,
    website: r.website || null,
    websiteNote: r.websiteNote || null,
    instagram: r.instagram || null,
    instagramNote: r.instagramNote || null,
    facebook: r.facebook || null,
    linkedin: r.linkedin || null,
    youtube: r.youtube || null,
    description: r.description || "",
    offerings: r.offerings || "",
    branches: r.branches || "",
    branchCount: r.branchCount ?? null,
    ratingsNote: r.ratingsNote || null,
    phone: phones[0]?.number || null,
    phoneLabel: phones[0]?.label || null,
    phoneSource: phones[0]?.source || null,
    phones: JSON.stringify(phones),
    email: emails[0]?.email || null,
    emailSource: emails[0]?.source || null,
    emails: JSON.stringify(emails),
    people: JSON.stringify(people),
    decisionMakerPhone: null,
    decisionMakerEmail: null,
    decisionMakerLinkedin: null,
    employeeCountVerified: est2.verified || null,
    employeeCountSource: est2.verifiedSource || null,
    employeeEstimate: est2.estimate || "",
    employeeEstimateBasis: est2.basis || "",
    employeeBand: employeeBand(mid),
    managementStructure,
    attendanceFit,
    attendanceFitReason,
    socialFit,
    socialFitReason,
    whyProspect,
    recommendedProduct: r.product,
    productReason,
    operationalProblems: JSON.stringify(operationalProblems),
    socialPresence,
    socialWeaknesses: JSON.stringify(socialWeaknesses),
    interestLevel: r.interest,
    interestReason,
    pitch,
    approach,
    opener,
    bestTimeToCall: pb.bestTime,
    callBlock,
    facts: JSON.stringify(facts),
    hook: r.hook || "",
    objections: JSON.stringify(pb.objections),
    discoveryQuestions: JSON.stringify(pb.discovery),
    sources: JSON.stringify(r.sources || []),
    researchDate: researchDate,
    verification: r.verification || "",
    confidence: r.confidence || "Medium",
    priorityScore: score,
  };
}
