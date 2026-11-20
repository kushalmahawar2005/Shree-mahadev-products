import "server-only";
import { recordError } from "@/lib/error-capture";

/**
 * One place that delivers login / verification OTPs. Used by customer login, the chat's guest
 * order check and the account "change number / delete" codes.
 *
 * Channels, first configured wins:
 *  1. WhatsApp Cloud API authentication template (no DLT needed): WHATSAPP_PROVIDER=meta,
 *     WHATSAPP_API_KEY, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_OTP_TEMPLATE (e.g. "login_otp",
 *     an approved AUTHENTICATION template with a "Copy code" button).
 *  2. Generic SMS/OTP relay: CUSTOMER_OTP_API_URL + CUSTOMER_OTP_API_KEY (old setup, kept as is).
 */

const GRAPH = "https://graph.facebook.com/v23.0";

function whatsappOtp() {
  const template = process.env.WHATSAPP_OTP_TEMPLATE;
  const token = process.env.WHATSAPP_API_KEY;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return process.env.WHATSAPP_PROVIDER === "meta" && template && token && phoneId
    ? { template, token, phoneId, lang: process.env.WHATSAPP_OTP_LANG || "en" }
    : null;
}

function relayOtp() {
  const url = process.env.CUSTOMER_OTP_API_URL;
  const key = process.env.CUSTOMER_OTP_API_KEY;
  return url && key ? { url, key } : null;
}

/** True when a real OTP channel is set up (otherwise dev builds fall back to the fixed mock code). */
export const otpConfigured = () => Boolean(whatsappOtp() || relayOtp());

/** 10-digit Indian number → "91XXXXXXXXXX" for WhatsApp. */
const toWhatsApp = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
};

/** Why a send failed, when the shopper can do something about it. */
export type OtpFailure = "same-as-sender" | "unavailable";

/** Meta error 131021: the recipient is the business's own WhatsApp number (it cannot message itself). */
const SAME_AS_SENDER = 131021;

async function sendWhatsAppOtp(config: NonNullable<ReturnType<typeof whatsappOtp>>, phone: string, code: string): Promise<OtpFailure | null> {
  const response = await fetch(`${GRAPH}/${config.phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toWhatsApp(phone),
      type: "template",
      template: {
        name: config.template,
        language: { code: config.lang },
        // Authentication templates take the code twice: the body {{1}} and the copy-code button.
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
        ],
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (response.ok) return null;
  const body = (await response.json().catch(() => ({}))) as { error?: { code?: number; message?: string } };
  // Never log the code or the full number.
  const detail = `WhatsApp OTP failed: HTTP ${response.status}, Meta error ${body.error?.code ?? "?"}: ${body.error?.message ?? "no message"} (to …${phone.slice(-4)})`;
  console.error(detail);
  // Also kept in /admin/errors, so the reason survives an app restart (runtime logs are cleared on deploy).
  await recordError({ source: "server", message: detail, path: "/login (OTP)" }).catch(() => {});
  return body.error?.code === SAME_AS_SENDER ? "same-as-sender" : "unavailable";
}

/**
 * Sends the code. Returns null on success, or why it failed, so callers show a message instead of
 * crashing ("same-as-sender": the shopper typed the store's own WhatsApp number).
 */
export async function sendOtpCodeDetailed(phone: string, code: string): Promise<OtpFailure | null> {
  try {
    const whatsapp = whatsappOtp();
    if (whatsapp) return await sendWhatsAppOtp(whatsapp, phone, code);
    const relay = relayOtp();
    if (!relay) return "unavailable";
    const response = await fetch(relay.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${relay.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ provider: process.env.CUSTOMER_OTP_PROVIDER, phone, otp: code }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok ? null : "unavailable";
  } catch (error) {
    const detail = `OTP send failed: ${error instanceof Error ? error.message : String(error)}`;
    console.error(detail);
    await recordError({ source: "server", message: detail, path: "/login (OTP)" }).catch(() => {});
    return "unavailable";
  }
}

/** Sends the code. Returns false on any failure. */
export async function sendOtpCode(phone: string, code: string): Promise<boolean> {
  return (await sendOtpCodeDetailed(phone, code)) === null;
}

/** Message for the shopper when a send failed. */
export function otpFailureMessage(reason: OtpFailure) {
  return reason === "same-as-sender"
    ? "This is the store's own WhatsApp number. Please enter your personal mobile number."
    : "Could not send the OTP right now. Please try again in a minute.";
}
