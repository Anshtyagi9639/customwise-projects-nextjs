import "server-only";
import type { EnquiryInput } from "@/lib/validation/enquiry";
import { enquiryServices } from "@/lib/validation/enquiry";
import { sendEnquiryEmail, type EmailOutcome } from "./email";
import { postToWebhook } from "./webhook";

/** Builds a failed outcome that carries a readable reason, whatever shape EmailOutcome has. */
function failure(reason: string): EmailOutcome {
  return { sent: false, reason, error: reason } as unknown as EmailOutcome;
}

/**
 * Delivers an enquiry. The email to ENQUIRY_TO_EMAIL is authoritative: the visitor only sees success
 * when the email provider has accepted the message. If ENQUIRY_WEBHOOK_URL is also set (e.g. a CRM),
 * a copy is posted there too; a webhook failure is logged but does not affect the email result.
 */
export async function deliverEnquiry(enquiry: EnquiryInput): Promise<EmailOutcome> {
  // 1. Stop early with a clear reason if the email settings are missing.
  const missing = ["EMAIL_API_KEY", "EMAIL_FROM", "ENQUIRY_TO_EMAIL"].filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    return failure(`Missing in .env.local: ${missing.join(", ")} (restart "npm run dev" after editing it)`);
  }

  // 2. Send the email.
  let outcome: EmailOutcome;
  try {
    outcome = await sendEnquiryEmail(enquiry);
  } catch (err) {
    return failure(`Email provider threw an error: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!outcome.sent) return outcome; // actions.ts logs and shows the reason

  // 3. Optional webhook copy. Never affects the result the visitor sees.
  const webhookUrl = process.env.ENQUIRY_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    try {
      const copy = await postToWebhook(webhookUrl, process.env.ENQUIRY_WEBHOOK_SECRET, {
        type: "website_enquiry",
        receivedAt: new Date().toISOString(),
        enquiry: {
          ...enquiry,
          website: undefined,
          serviceLabel: enquiryServices.find((s) => s.value === enquiry.service)?.label ?? enquiry.service,
        },
      });
      if (!copy.delivered) console.warn("[enquiry] Email sent, but the optional webhook copy failed.");
    } catch (err) {
      console.warn("[enquiry] Email sent, but the optional webhook copy threw an error:", err);
    }
  }

  return outcome;
}