import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { fail, handle, HttpError, ok, readJSON, str } from "@/lib/api";
import { NOT_CONTACTED_STATUSES } from "@/lib/constants";
import { leadSummary, logStatusChange } from "@/lib/leads";
import { toActivity } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return fail("SMTP is not configured. Add SMTP_HOST, SMTP_USER and SMTP_PASS to .env.local (see Settings) or use the Mail app / Gmail buttons.", 400);
  }
  const body = await readJSON<Record<string, unknown>>(req);
  const businessId = str(body.businessId, 120);
  const to = str(body.to, 300).trim();
  const subject = str(body.subject, 300).trim();
  const text = str(body.body, 50000);
  if (!/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(to)) throw new HttpError("Enter one valid recipient email address");
  if (!subject || !text) throw new HttpError("Subject and message are required");
  const lead = await prisma.business.findUnique({ where: { id: businessId } });
  if (!lead) return fail("Unknown business", 404);

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: String(SMTP_SECURE).toLowerCase() === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  const info = await transport.sendMail({ from: SMTP_FROM || SMTP_USER, to, subject, text });

  const activity = await prisma.activity.create({
    data: {
      businessId,
      type: "EMAIL",
      outcome: "Sent via SMTP",
      summary: `Email sent: ${subject}`,
      details: text,
      meta: JSON.stringify({ to, messageId: info.messageId, accepted: info.accepted }),
    },
  });
  const update: Record<string, unknown> = { lastContactedAt: new Date() };
  if (NOT_CONTACTED_STATUSES.includes(lead.status)) {
    update.status = "Email Sent";
    await logStatusChange(businessId, lead.status, "Email Sent", "Email sent via SMTP");
  }
  await prisma.business.update({ where: { id: businessId }, data: update });
  return ok({ messageId: info.messageId, activity: toActivity(activity), lead: await leadSummary(businessId) });
});
