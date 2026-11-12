import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { cookies, headers } from "next/headers";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { site } from "@/data/site";
import { db } from "./db";
import { kickOutbox } from "./mail";

/*
 * Profile & security data for /account/profile. Every function takes the customer id from
 * requireCustomer() in the caller: nothing here trusts an id sent by the browser.
 */

type Rows = RowDataPacket[];
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const siteUrl = () =>
  (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://swadeshimahadevproducts.com"
  ).replace(/\/$/, "");

/* ───────────────────────── Profile ───────────────────────── */

export const GENDERS = ["female", "male", "other", "na"] as const;
export type Gender = (typeof GENDERS)[number];
export const PREF_KEYS = [
  "wa_orders",
  "sms_orders",
  "wa_offers",
  "email_offers",
] as const;
export type PrefKey = (typeof PREF_KEYS)[number];
export type Language = "en" | "hi";

export type ProfileData = {
  id: number;
  name: string;
  phone: string;
  email: string;
  emailVerified: boolean;
  dob: string | null; // YYYY-MM-DD
  gender: Gender | null;
  prefs: Record<PrefKey, boolean>;
  language: Language;
  deleteRequestedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

export async function getProfile(customerId: number): Promise<ProfileData | null> {
  const [[c]] = await db().query<Rows>(
    `SELECT c.id, c.name, c.phone, c.email, c.dob, c.gender, c.email_verified_at,
            c.pref_wa_orders, c.pref_sms_orders, c.pref_wa_offers, c.pref_email_offers,
            c.message_language, c.delete_requested_at, c.created_at,
            COALESCE(c.last_login_at, (SELECT MAX(s.created_at) FROM customer_sessions s WHERE s.customer_id = c.id)) AS last_login
       FROM customers c WHERE c.id = ?`,
    [customerId],
  );
  if (!c) return null;
  const gender = GENDERS.includes(c.gender) ? (c.gender as Gender) : null;
  return {
    id: Number(c.id),
    name: String(c.name ?? ""),
    phone: String(c.phone),
    email: String(c.email ?? ""),
    emailVerified: Boolean(c.email && c.email_verified_at),
    dob: c.dob ? String(c.dob).slice(0, 10) : null,
    gender,
    prefs: {
      wa_orders: Boolean(c.pref_wa_orders),
      sms_orders: Boolean(c.pref_sms_orders),
      wa_offers: Boolean(c.pref_wa_offers),
      email_offers: Boolean(c.pref_email_offers) && Boolean(c.email),
    },
    language: c.message_language === "hi" ? "hi" : "en",
    deleteRequestedAt: c.delete_requested_at ? String(c.delete_requested_at) : null,
    lastLoginAt: c.last_login ? String(c.last_login) : null,
    createdAt: String(c.created_at),
  };
}

/** Saves personal details. A changed email loses its verified mark. */
export async function updatePersonal(
  customerId: number,
  data: { name: string; email: string | null; dob: string | null; gender: Gender | null },
) {
  await db().execute(
    `UPDATE customers SET
       email_verified_at = IF(COALESCE(email,'') = COALESCE(?,''), email_verified_at, NULL),
       email_verify_hash = IF(COALESCE(email,'') = COALESCE(?,''), email_verify_hash, NULL),
       name = ?, email = ?, dob = ?, gender = ?
     WHERE id = ?`,
    [data.email, data.email, data.name, data.email, data.dob, data.gender, customerId],
  );
  // No email means no email offers.
  if (!data.email)
    await db().execute("UPDATE customers SET pref_email_offers = 0 WHERE id = ?", [customerId]);
}

/** Column per preference key (fixed whitelist, never user input in SQL). */
const PREF_COLUMN: Record<PrefKey, string> = {
  wa_orders: "pref_wa_orders",
  sms_orders: "pref_sms_orders",
  wa_offers: "pref_wa_offers",
  email_offers: "pref_email_offers",
};

/** Updates one preference and appends a consent row (audit trail). */
export async function setPreference(
  customerId: number,
  key: PrefKey,
  granted: boolean,
  ip: string | null,
) {
  await db().execute(`UPDATE customers SET ${PREF_COLUMN[key]} = ? WHERE id = ?`, [
    granted ? 1 : 0,
    customerId,
  ]);
  await db().execute(
    "INSERT INTO customer_consents (customer_id, channel, granted, source, ip) VALUES (?,?,?,?,?)",
    [customerId, key, granted ? 1 : 0, "account_profile", ip?.slice(0, 45) ?? null],
  );
}

export async function setLanguage(customerId: number, language: Language) {
  await db().execute("UPDATE customers SET message_language = ? WHERE id = ?", [language, customerId]);
}

/* ───────────────────────── Email verification ───────────────────────── */

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/**
 * Creates a 24h verification token (only its hash is stored) and queues the email through
 * email_outbox. Returns the link so dev builds without a mail key can still test it.
 */
export async function queueEmailVerification(customerId: number) {
  const [[c]] = await db().query<Rows>(
    "SELECT name, email, email_verified_at FROM customers WHERE id = ?",
    [customerId],
  );
  const email = String(c?.email ?? "");
  if (!c || !email) return { ok: false as const, error: "Add an email first." };
  if (c.email_verified_at) return { ok: false as const, error: "This email is already verified." };
  const raw = randomBytes(32).toString("base64url");
  await db().execute(
    "UPDATE customers SET email_verify_hash = ?, email_verify_expires = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE id = ?",
    [sha(raw), customerId],
  );
  const link = `${siteUrl()}/account/profile?verify=${raw}`;
  const first = escapeHtml(String(c.name ?? "").split(" ")[0] || "there");
  const html = `<!doctype html><html><body style="margin:0;background:#FBF8F2;font-family:Arial,sans-serif;color:#17251D">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-size:16px">Namaste ${first},</p>
<p style="font-size:15px;line-height:1.6">Please confirm this email for your ${escapeHtml(site.name)} account. We use it for order receipts and invoices.</p>
<p style="margin:28px 0"><a href="${link}" style="background:#1F4D36;color:#fff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:bold;display:inline-block">Verify my email</a></p>
<p style="font-size:13px;color:#5B6660">This link works for 24 hours. If you did not ask for this, you can ignore this email.</p>
</div></body></html>`;
  const text = `Namaste ${first},\n\nConfirm this email for your ${site.name} account:\n${link}\n\nThis link works for 24 hours. If you did not ask for this, ignore this email.`;
  await db().execute<ResultSetHeader>(
    "INSERT INTO email_outbox (order_id, template, to_email, subject, html, text_body, dedupe_key) VALUES (NULL,?,?,?,?,?,NULL)",
    ["verify_email", email, `Verify your email · ${site.name}`, html, text],
  );
  kickOutbox();
  return { ok: true as const, email, link };
}

export async function confirmEmailVerification(customerId: number, rawToken: string) {
  const [r] = await db().execute<ResultSetHeader>(
    `UPDATE customers SET email_verified_at = NOW(), email_verify_hash = NULL, email_verify_expires = NULL
      WHERE id = ? AND email IS NOT NULL AND email_verify_hash = ? AND email_verify_expires > NOW()`,
    [customerId, sha(rawToken)],
  );
  return r.affectedRows > 0;
}

/* ───────────────────────── Account OTPs (change number, delete) ───────────────────────── */

export type OtpPurpose = "change_phone" | "delete";
const MOCK_OTP = "123456";
const otpGateway = () => {
  const url = process.env.CUSTOMER_OTP_API_URL;
  const key = process.env.CUSTOMER_OTP_API_KEY;
  return url && key ? { url, key } : null;
};
/** Same rule as login: fixed code only in non-production builds with no gateway configured. */
export const otpMock = () => !otpGateway() && process.env.NODE_ENV !== "production";
export const otpAvailable = () => Boolean(otpGateway()) || otpMock();

/** Mirrors sendOtp() in customer-account-actions.ts (same gateway + payload). */
async function sendOtp(phone: string, code: string): Promise<boolean> {
  const gw = otpGateway();
  if (!gw) return false;
  try {
    const response = await fetch(gw.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${gw.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ provider: process.env.CUSTOMER_OTP_PROVIDER, phone, otp: code }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export const RESEND_SECONDS = 30;
export const MAX_SENDS = 4; // first send + 3 resends per 15 minutes

/** Issues a hashed 5-minute code. Enforces the 30s resend gap and send cap on the server. */
export async function issueAccountOtp(customerId: number, purpose: OtpPurpose, phone: string) {
  const [[stats]] = await db().query<Rows>(
    `SELECT COUNT(*) AS sends, TIMESTAMPDIFF(SECOND, MAX(created_at), NOW()) AS since
       FROM account_otps WHERE customer_id = ? AND purpose = ? AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)`,
    [customerId, purpose],
  );
  const sends = Number(stats?.sends ?? 0);
  if (sends >= MAX_SENDS)
    return { ok: false as const, error: "Too many codes sent. Please try again in 15 minutes." };
  if (sends > 0 && stats.since !== null && Number(stats.since) < RESEND_SECONDS)
    return {
      ok: false as const,
      error: `Please wait ${RESEND_SECONDS - Number(stats.since)}s before asking for a new code.`,
    };
  const mock = otpMock();
  if (!mock && !otpGateway())
    return { ok: false as const, error: "OTP service is not set up yet. Please message us on WhatsApp." };
  const code = mock ? MOCK_OTP : String(randomInt(100000, 1000000));
  await db().execute(
    "UPDATE account_otps SET used_at = NOW() WHERE customer_id = ? AND purpose = ? AND used_at IS NULL",
    [customerId, purpose],
  );
  await db().execute(
    "INSERT INTO account_otps (customer_id, purpose, phone, code_hash, expires_at) VALUES (?,?,?,?,DATE_ADD(NOW(), INTERVAL 5 MINUTE))",
    [customerId, purpose, phone, sha(code)],
  );
  if (!mock && !(await sendOtp(phone, code)))
    return { ok: false as const, error: "Could not send the OTP right now. Please try again in a minute." };
  return {
    ok: true as const,
    resendsLeft: MAX_SENDS - sends - 1,
    devCode: mock ? MOCK_OTP : undefined,
  };
}

/** Checks (and consumes) a code. Five wrong tries burn it. */
export async function checkAccountOtp(
  customerId: number,
  purpose: OtpPurpose,
  phone: string,
  code: string,
) {
  const [[otp]] = await db().query<Rows>(
    `SELECT id, code_hash, attempts FROM account_otps
      WHERE customer_id = ? AND purpose = ? AND phone = ? AND used_at IS NULL AND expires_at > NOW()
      ORDER BY id DESC LIMIT 1`,
    [customerId, purpose, phone],
  );
  if (!otp || Number(otp.attempts) >= 5 || sha(code) !== otp.code_hash) {
    if (otp) await db().execute("UPDATE account_otps SET attempts = attempts + 1 WHERE id = ?", [otp.id]);
    return false;
  }
  await db().execute("UPDATE account_otps SET used_at = NOW() WHERE id = ?", [otp.id]);
  return true;
}

export async function phoneTaken(phone: string, exceptCustomerId: number) {
  const [[row]] = await db().query<Rows>("SELECT id FROM customers WHERE phone = ? AND id <> ?", [
    phone,
    exceptCustomerId,
  ]);
  return Boolean(row);
}

/** Moves the login to a new number. Returns false when the number is already linked elsewhere. */
export async function changePhone(customerId: number, phone: string) {
  try {
    await db().execute("UPDATE customers SET phone = ? WHERE id = ?", [phone, customerId]);
    return true;
  } catch (e) {
    if ((e as { code?: string }).code === "ER_DUP_ENTRY") return false;
    throw e;
  }
}

/* ───────────────────────── Sessions ───────────────────────── */

const SESSION_COOKIE = "smp_customer";

/** Hash of this browser's session token (same scheme as customer-auth.ts). Signature is checked there. */
async function currentTokenHash() {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  const raw = value?.split(".")[0];
  return raw ? sha(raw) : null;
}

async function requestMeta() {
  const h = await headers();
  return {
    ua: h.get("user-agent")?.slice(0, 255) ?? null,
    ip: (h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null)?.slice(0, 45) ?? null,
    // Only set when the host/CDN adds a geo header; there is no IP lookup.
    city: (h.get("x-vercel-ip-city") || h.get("cf-ipcity") || null)?.slice(0, 80) ?? null,
  };
}

/**
 * Fills device info on this browser's session row and bumps last_seen_at. Needed until
 * createCustomerSession() records user agent / IP itself (see report).
 */
export async function touchCurrentSession(customerId: number) {
  const tokenHash = await currentTokenHash();
  if (!tokenHash) return;
  const meta = await requestMeta();
  await db()
    .execute(
      `UPDATE customer_sessions SET
         user_agent = COALESCE(user_agent, ?), ip = COALESCE(ip, ?),
         city = COALESCE(city, ?), last_seen_at = NOW()
       WHERE token_hash = ? AND customer_id = ?`,
      [meta.ua, meta.ip, meta.city ? decodeURIComponent(meta.city) : null, tokenHash, customerId],
    )
    .catch((e) => console.error("touchCurrentSession", e));
}

export type DeviceKind = "phone" | "tablet" | "desktop";
export type SessionInfo = {
  id: number;
  device: DeviceKind;
  browser: string;
  os: string;
  city: string | null;
  lastActive: string;
  createdAt: string;
  current: boolean;
};

/** Small user-agent parser: enough for "Chrome on Android" style labels. */
export function parseUserAgent(ua: string | null) {
  const s = ua ?? "";
  const device: DeviceKind = /iPad|Tablet/i.test(s)
    ? "tablet"
    : /Mobi|iPhone|Android/i.test(s)
      ? "phone"
      : "desktop";
  const os = /iPhone|iPad|iPod/.test(s)
    ? "iOS"
    : /Android/.test(s)
      ? "Android"
      : /Windows/.test(s)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(s)
          ? "macOS"
          : /CrOS/.test(s)
            ? "ChromeOS"
            : /Linux/.test(s)
              ? "Linux"
              : "Unknown OS";
  const browser = /Edg\//.test(s)
    ? "Edge"
    : /OPR\/|Opera/.test(s)
      ? "Opera"
      : /SamsungBrowser/.test(s)
        ? "Samsung Internet"
        : /FxiOS|Firefox\//.test(s)
          ? "Firefox"
          : /CriOS|Chrome\//.test(s)
            ? "Chrome"
            : /Safari\//.test(s)
              ? "Safari"
              : s
                ? "Browser"
                : "Unknown browser";
  return { device, os, browser };
}

export async function listSessions(customerId: number): Promise<SessionInfo[]> {
  const tokenHash = await currentTokenHash();
  const [rows] = await db().query<Rows>(
    `SELECT id, token_hash, user_agent, city, created_at, COALESCE(last_seen_at, created_at) AS last_active
       FROM customer_sessions WHERE customer_id = ? AND expires_at > NOW()
      ORDER BY (token_hash = ?) DESC, last_active DESC LIMIT 20`,
    [customerId, tokenHash ?? ""],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    ...parseUserAgent(r.user_agent ? String(r.user_agent) : null),
    city: r.city ? String(r.city) : null,
    lastActive: String(r.last_active),
    createdAt: String(r.created_at),
    current: r.token_hash === tokenHash,
  }));
}

/** Deletes one session of this customer. Returns whether it was this browser's own session. */
export async function deleteSession(customerId: number, sessionId: number) {
  const tokenHash = await currentTokenHash();
  const [[row]] = await db().query<Rows>(
    "SELECT token_hash FROM customer_sessions WHERE id = ? AND customer_id = ?",
    [sessionId, customerId],
  );
  if (!row) return { found: false, current: false };
  await db().execute("DELETE FROM customer_sessions WHERE id = ? AND customer_id = ?", [sessionId, customerId]);
  return { found: true, current: row.token_hash === tokenHash };
}

export async function deleteOtherSessions(customerId: number) {
  const tokenHash = await currentTokenHash();
  const [r] = await db().execute<ResultSetHeader>(
    "DELETE FROM customer_sessions WHERE customer_id = ? AND token_hash <> ?",
    [customerId, tokenHash ?? ""],
  );
  return r.affectedRows;
}

/* ───────────────────────── Privacy ───────────────────────── */

const omit = (row: RowDataPacket, key: string) =>
  Object.fromEntries(Object.entries(row).filter(([k]) => k !== key));

/** Everything we hold about the customer, as plain JSON. */
export async function exportCustomerData(customerId: number) {
  const profile = await getProfile(customerId);
  const [addresses] = await db().query<Rows>(
    "SELECT * FROM addresses WHERE customer_id = ? ORDER BY id",
    [customerId],
  );
  const [orders] = await db().query<Rows>(
    `SELECT id, order_no, status, payment_method, customer_name, phone, email,
            address_line1, address_line2, city, state, pincode,
            subtotal, discount, coupon_code, shipping, cod_fee, total, customer_note,
            paid_at, cancelled_at, created_at
       FROM orders WHERE customer_id = ? ORDER BY id`,
    [customerId],
  );
  const ids = orders.map((o) => o.id);
  const [items] = ids.length
    ? await db().query<Rows>(
        `SELECT order_id, product_title, variant_title, sku, unit_price, quantity, line_total
           FROM order_items WHERE order_id IN (?) ORDER BY id`,
        [ids],
      )
    : [[] as Rows];
  const [consents] = await db().query<Rows>(
    "SELECT channel, granted, source, created_at FROM customer_consents WHERE customer_id = ? ORDER BY id",
    [customerId],
  );
  return {
    exportedAt: new Date().toISOString(),
    store: site.name,
    note: "All amounts are in Indian rupees (₹). Dates are in IST.",
    profile,
    addresses: addresses.map((a) => omit(a, "customer_id")),
    orders: orders.map(({ id, ...o }) => ({
      ...o,
      items: items
        .filter((i) => i.order_id === id)
        .map((i) => omit(i, "order_id")),
    })),
    consents,
  };
}

/** Starts the 7-day deletion grace period and signs the customer out everywhere. */
export async function requestDeletion(customerId: number) {
  await db().execute(
    "UPDATE customers SET delete_requested_at = NOW() WHERE id = ? AND delete_requested_at IS NULL",
    [customerId],
  );
  await db().execute("DELETE FROM customer_sessions WHERE customer_id = ?", [customerId]);
}

export async function cancelDeletion(customerId: number) {
  await db().execute("UPDATE customers SET delete_requested_at = NULL WHERE id = ?", [customerId]);
}
