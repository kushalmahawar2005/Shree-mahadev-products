import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * PayU India hosted checkout (form POST to PayU, user returns to surl/furl).
 * Hash formulas: https://docs.payu.in/docs/generate-hash-merchant-hosted
 */

const LIVE = process.env.PAYU_MODE === "live";

export const PAYU_PAYMENT_URL = LIVE ? "https://secure.payu.in/_payment" : "https://test.payu.in/_payment";
const PAYU_VERIFY_URL = LIVE
  ? "https://info.payu.in/merchant/postservice?form=2"
  : "https://test.payu.in/merchant/postservice?form=2";

function creds() {
  const key = process.env.PAYU_KEY;
  const salt = process.env.PAYU_SALT;
  if (!key || !salt) throw new Error("PAYU_KEY / PAYU_SALT are not set");
  return { key, salt };
}

export function payuConfigured() {
  return Boolean(process.env.PAYU_KEY && process.env.PAYU_SALT);
}

const sha512 = (s: string) => createHash("sha512").update(s).digest("hex");

export type PayuRequest = {
  txnid: string;
  amount: string; // "1144.00"
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  udf1?: string; // order token
};

/** Fields for the auto-submitting form that sends the shopper to PayU. */
export function buildPayuForm(req: PayuRequest): Record<string, string> {
  const { key, salt } = creds();
  const udf1 = req.udf1 ?? "";
  const hash = sha512(
    [key, req.txnid, req.amount, req.productinfo, req.firstname, req.email, udf1, "", "", "", "", "", "", "", "", "", salt].join("|"),
  );
  return { key, ...req, udf1, hash, service_provider: "payu_paisa" };
}

/** Checks the reverse hash PayU sends back on surl/furl. */
export function verifyPayuResponse(p: Record<string, string>): boolean {
  const { key, salt } = creds();
  if (p.key !== key || !p.hash) return false;
  const base = [
    salt, p.status ?? "", "", "", "", "", "",
    p.udf5 ?? "", p.udf4 ?? "", p.udf3 ?? "", p.udf2 ?? "", p.udf1 ?? "",
    p.email ?? "", p.firstname ?? "", p.productinfo ?? "", p.amount ?? "", p.txnid ?? "", key,
  ].join("|");
  const expected = sha512(p.additionalCharges ? `${p.additionalCharges}|${base}` : base);
  const a = Buffer.from(expected);
  const b = Buffer.from(p.hash.toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Server-to-server confirmation (don't trust the browser redirect alone). */
export async function verifyPaymentWithPayu(txnid: string): Promise<{ status: string; amount: number; mihpayid?: string } | null> {
  const { key, salt } = creds();
  const body = new URLSearchParams({
    key,
    command: "verify_payment",
    var1: txnid,
    hash: sha512([key, "verify_payment", txnid, salt].join("|")),
  });
  try {
    const res = await fetch(PAYU_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json()) as { transaction_details?: Record<string, { status?: string; amt?: string; mihpayid?: string }> };
    const t = json.transaction_details?.[txnid];
    if (!t?.status) return null;
    return { status: t.status, amount: Number(t.amt), mihpayid: t.mihpayid };
  } catch {
    return null;
  }
}
