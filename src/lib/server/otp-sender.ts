import "server-only";

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

async function sendWhatsAppOtp(config: NonNullable<ReturnType<typeof whatsappOtp>>, phone: string, code: string) {
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
  if (response.ok) return true;
  const body = (await response.json().catch(() => ({}))) as { error?: { code?: number; message?: string } };
  // Never log the code itself.
  console.error("whatsapp otp failed", response.status, body.error?.code, body.error?.message);
  return false;
}

/** Sends the code. Returns false on any failure, so callers show a message instead of crashing. */
export async function sendOtpCode(phone: string, code: string): Promise<boolean> {
  try {
    const whatsapp = whatsappOtp();
    if (whatsapp) return await sendWhatsAppOtp(whatsapp, phone, code);
    const relay = relayOtp();
    if (!relay) return false;
    const response = await fetch(relay.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${relay.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ provider: process.env.CUSTOMER_OTP_PROVIDER, phone, otp: code }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch (error) {
    console.error("otp send failed", error instanceof Error ? error.message : error);
    return false;
  }
}
