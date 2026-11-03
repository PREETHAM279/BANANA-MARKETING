// Message generators for WhatsApp, email and calls.
// Pure functions: the same lead + your Settings always produce the same draft,
// which you can edit before sending. Only researched facts are referenced.

import { CATEGORY_META } from "./constants";
import { fillPlaceholders, formatDayLong } from "./format";
import type { LeadListItem } from "./types";

export type MessageKind = "intro" | "followup" | "afterCall" | "meeting" | "reengage";

export const MESSAGE_KINDS: { id: MessageKind; label: string }[] = [
  { id: "intro", label: "Introduction" },
  { id: "followup", label: "Follow-up (no reply)" },
  { id: "afterCall", label: "After a call" },
  { id: "meeting", label: "Meeting confirmation" },
  { id: "reengage", label: "Re-engage (later)" },
];

type Settings = Record<string, string>;

function meta(lead: LeadListItem) {
  return CATEGORY_META[lead.category] ?? CATEGORY_META["Other Services"];
}

export function greetingName(lead: LeadListItem): string {
  if (lead.ownerName) return lead.ownerName.replace(/^Coach\s+/i, "");
  return `${lead.name} team`;
}

function me(settings: Settings) {
  const name = settings.yourName?.trim() || "[your name]";
  const company = settings.yourCompany?.trim() || "[your company]";
  return { name, company };
}

function scale(lead: LeadListItem) {
  const m = meta(lead);
  return lead.branchCount && lead.branchCount > 1 ? `${lead.branchCount} ${m.units}` : `your ${m.unit}`;
}

function productLines(lead: LeadListItem, settings: Settings) {
  const m = meta(lead);
  const social = settings.productSocial?.trim() || "our Social Media Management app";
  const attendance = settings.productAttendance?.trim() || "our Employee Attendance app";
  const each = lead.branchCount && lead.branchCount > 1 ? ` for each of your ${lead.branchCount} ${m.units}` : "";
  return {
    social,
    attendance,
    socialShort: `${social} - plan your content calendar, manage posts in one place and track what drives engagement`,
    attendanceShort: `${attendance} - one-tap clock-in/clock-out for your ${m.staff}, employee records in one place and attendance reports${each}`,
  };
}

function productPhrase(lead: LeadListItem, settings: Settings) {
  const p = productLines(lead, settings);
  if (lead.recommendedProduct === "Social Media") return p.social;
  if (lead.recommendedProduct === "Attendance") return p.attendance;
  return `${p.attendance} and ${p.social}`;
}

export function whatsappMessage(lead: LeadListItem, settings: Settings, kind: MessageKind, extra?: { followUpDate?: string | null; meetingAt?: string | null }): string {
  const m = meta(lead);
  const { name, company } = me(settings);
  const greet = greetingName(lead);
  const p = productLines(lead, settings);
  const demo = settings.demoLink?.trim() ? `\n\nShort demo: ${settings.demoLink.trim()}` : "";
  const hook = lead.hook ? ` ${lead.hook.replace(/\.$/, "")}.` : "";

  switch (kind) {
    case "intro": {
      let offer: string;
      if (lead.recommendedProduct === "Social Media") offer = `We help ${m.plural} in Bengaluru with ${p.socialShort}.`;
      else if (lead.recommendedProduct === "Attendance") offer = `We help ${m.plural} in Bengaluru replace attendance registers with ${p.attendanceShort}.`;
      else offer = `We help ${m.plural} in Bengaluru with two things:\n1) ${p.attendanceShort}\n2) ${p.socialShort}`;
      return `Hi ${greet}, this is ${name} from ${company}.${hook}\n\n${offer}\n\nWould you be open to a 15-minute demo this week?${demo}`;
    }
    case "followup":
      return `Hi ${greet}, ${name} from ${company} here - following up on my earlier message about ${productPhrase(lead, settings)} for ${lead.name}. Happy to share a 2-minute video or drop by your ${lead.locality || "Bengaluru"} ${m.unit} for a quick demo. Which day suits you?`;
    case "afterCall": {
      const when = extra?.followUpDate ? ` I'll get back to you on ${formatDayLong(extra.followUpDate)} as discussed.` : "";
      return `Thank you for your time on the call today, ${greet}. As discussed, here is a quick summary: ${productPhrase(lead, settings)} for ${lead.name} (${scale(lead)}).${when}${demo}\n\n- ${name}, ${company}`;
    }
    case "meeting": {
      const when = extra?.meetingAt ? ` on ${extra.meetingAt.replace("T", " at ")}` : "";
      return `Hi ${greet}, confirming our demo${when}. I'll bring a sample ${lead.recommendedProduct === "Attendance" ? "attendance report" : lead.recommendedProduct === "Social Media" ? "content calendar" : "attendance report and content calendar"} for ${lead.name}. Please let me know if the timing changes. - ${name}, ${company}`;
    }
    case "reengage":
      return `Hi ${greet}, ${name} from ${company} again. We spoke a while ago about ${productPhrase(lead, settings)}. Is it a better time now to take a quick look? Happy to work around your schedule.`;
  }
}

export function emailMessage(lead: LeadListItem, settings: Settings, kind: MessageKind, extra?: { followUpDate?: string | null; meetingAt?: string | null }): { subjects: string[]; body: string } {
  const m = meta(lead);
  const { name, company } = me(settings);
  const greet = greetingName(lead);
  const p = productLines(lead, settings);
  const signature = settings.signature?.trim() || [name, settings.yourRole?.trim(), company, settings.yourPhone?.trim(), settings.yourEmail?.trim()].filter(Boolean).join("\n");
  const demo = settings.demoLink?.trim() ? `\n\nYou can also see a short demo here: ${settings.demoLink.trim()}` : "";
  const many = lead.branchCount && lead.branchCount > 1;

  switch (kind) {
    case "intro": {
      const subjects =
        lead.recommendedProduct === "Social Media"
          ? [`A content calendar for ${lead.name}`, `Quick idea for ${lead.name}'s social media`, `15-minute demo for ${lead.name}?`]
          : lead.recommendedProduct === "Attendance"
            ? [`Staff attendance for ${lead.name}${many ? ` across ${lead.branchCount} ${m.units}` : ""}`, `Replacing attendance registers at ${lead.name}`, `15-minute demo for ${lead.name}?`]
            : [`${lead.name}: staff attendance + social media, simplified`, `Quick idea for ${lead.name}${many ? `'s ${lead.branchCount} ${m.units}` : ""}`, `15-minute demo for ${lead.name}?`];
      const bullets =
        lead.recommendedProduct === "Social Media"
          ? `- ${p.socialShort}.`
          : lead.recommendedProduct === "Attendance"
            ? `- ${p.attendanceShort}.`
            : `- ${p.attendanceShort}.\n- ${p.socialShort}.`;
      const body = `Hi ${greet},

${lead.hook || `I came across ${lead.name} while researching ${m.plural} in Bengaluru.`}

I'm ${name} from ${company}. We work with ${m.plural} in Bengaluru on ${lead.recommendedProduct === "Both" ? "two recurring headaches" : "a recurring headache"}:

${bullets}

${many ? `With ${lead.branchCount} ${m.units}, ` : ""}this usually saves managers hours every month and keeps the brand consistent.

Would you have 15 minutes this week for a quick demo? I can show it with an example from ${lead.name}.${demo}

Best regards,
${signature}`;
      return { subjects, body };
    }
    case "followup":
      return {
        subjects: [`Following up - ${lead.name}`, `Re: quick demo for ${lead.name}`],
        body: `Hi ${greet},

Following up on my earlier note about ${productPhrase(lead, settings)} for ${lead.name}.

If it helps, I can visit your ${lead.locality || "Bengaluru"} ${m.unit} for a 15-minute walkthrough, or send a short video first. Which would you prefer?

Best regards,
${signature}`,
      };
    case "afterCall":
      return {
        subjects: [`Summary of our call - ${lead.name}`, `Next steps for ${lead.name}`],
        body: `Hi ${greet},

Thank you for your time on the call today. As discussed:

- What we offer: ${productPhrase(lead, settings)}.
- How it helps ${lead.name}: ${lead.recommendedProduct === "Social Media" ? "a consistent, planned social presence with clear performance tracking" : lead.recommendedProduct === "Attendance" ? "accurate clock-in/clock-out, one set of employee records and ready attendance reports" : "accurate staff attendance reports and a planned, measurable social media presence"}.
${extra?.followUpDate ? `- Next step: I'll get back to you on ${formatDayLong(extra.followUpDate)}.\n` : ""}${demo}
Best regards,
${signature}`,
      };
    case "meeting":
      return {
        subjects: [`Demo confirmation - ${lead.name}`],
        body: `Hi ${greet},

This is to confirm our demo${extra?.meetingAt ? ` on ${extra.meetingAt.replace("T", " at ")}` : ""}. I'll walk you through ${productPhrase(lead, settings)} using an example from ${lead.name}.

Please let me know if the timing changes.

Best regards,
${signature}`,
      };
    case "reengage":
      return {
        subjects: [`Checking in - ${lead.name}`],
        body: `Hi ${greet},

We spoke a while ago about ${productPhrase(lead, settings)}. Since then we've helped more ${m.plural} in Bengaluru get started. Would it be a good time to take another look?

Best regards,
${signature}`,
      };
  }
}

export function personalize(text: string, settings: Settings): string {
  return fillPlaceholders(text, { yourName: settings.yourName?.trim() || "", yourCompany: settings.yourCompany?.trim() || "" });
}
