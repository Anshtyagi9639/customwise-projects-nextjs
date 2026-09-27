"use server";

import { enquirySchema, type EnquiryInput, type EnquiryResult } from "@/lib/validation/enquiry";
import { deliverEnquiry } from "./deliver";
import { isRateLimited } from "./rate-limit";
import { clientIp } from "./webhook";

const SEND_FAILED = "We couldn't send your enquiry right now. Please try again or contact us directly.";
const isDev = process.env.NODE_ENV === "development";

/** Pulls a readable reason out of any outcome/error shape (reason, error, message...). */
function describe(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const r = o.reason ?? o.error ?? o.message;
    if (r) return typeof r === "string" ? r : describe(r);
    return JSON.stringify(o);
  }
  return String(value ?? "unknown reason");
}

/** Logs the real reason on the server; shows it on screen only in development. */
function sendFailed(reason: string): EnquiryResult {
  console.error("[enquiry] Email not sent:", reason);
  return { ok: false, message: isDev ? `${SEND_FAILED} [DEV: ${reason}]` : SEND_FAILED };
}

/** Server-side enquiry handler: validates, filters spam, and sends the enquiry email. */
export async function submitEnquiry(input: unknown): Promise<EnquiryResult> {
  const parsed = enquirySchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof EnquiryInput, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof EnquiryInput | undefined;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Some details need attention.", fieldErrors };
  }

  // Honeypot filled (bots): report success so they learn nothing, but send nothing.
  if (parsed.data.website) return { ok: true };

  if (isRateLimited(`enquiry:${await clientIp()}`)) {
    return {
      ok: false,
      message: "Too many enquiries have been sent from this connection. Please wait a few minutes and try again.",
    };
  }

  try {
    const outcome = await deliverEnquiry(parsed.data);
    // Success is only reported when the email provider has accepted the message.
    if (outcome.sent) return { ok: true };
    return sendFailed(describe(outcome));
  } catch (err) {
    return sendFailed(`Unexpected error: ${describe(err)}`);
  }
}