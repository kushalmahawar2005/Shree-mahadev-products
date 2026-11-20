"use server";

import { createHash, randomBytes, randomInt } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { cleanPhone, createCustomerSession, requireCustomer } from "@/lib/server/customer-auth";
import { requestCustomerOtpAction, verifyCustomerOtpAction } from "@/lib/customer-account-actions";
import { mailConfigured, sendLoginCodeEmail } from "@/lib/server/mail";
import { clientIp, rateLimit, resetLimit } from "@/lib/server/rate-limit";

/*
 * Login with email, for shoppers without WhatsApp.
 *   1. requestEmailOtpAction: a 6-digit code is emailed (only its hash is stored).
 *   2. verifyEmailOtpAction: right code →
 *        - an account whose email is verified and matches → signed in;
 *        - otherwise a short-lived signup token goes into an httpOnly cookie and the page asks for the
 *          mobile number (orders, delivery and WhatsApp updates need it).
 *   3. completeEmailSignupAction: creates the account with that number + the verified email.
 *      A number that already has an account is refused (sign in with WhatsApp instead), so nobody can
 *      reach someone else's orders by typing their number.
 */

const CODE_MINUTES = 10;
const SIGNUP_MINUTES = 15;
const SIGNUP_COOKIE = "smp_email_signup";
const MOCK_OTP = "123456";

const Email = z.string().trim().toLowerCase().email().max(160);
const Phone = z.string().regex(/^(?:\+?91|0)?[6-9]\d{9}$/);
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
/** Local development without any mail setup: fixed code shown on the page (never in production). */
const mockMail = () => !mailConfigured() && process.env.NODE_ENV !== "production";

export async function requestEmailOtpAction(raw: unknown) {
  const parsed = z.object({ email: Email }).strict().safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Enter a valid email address." };
  const email = parsed.data.email;
  if (!mailConfigured() && !mockMail()) return { ok: false as const, error: "Email login is not available right now. Please use WhatsApp." };

  const ip = await clientIp();
  // Same spirit as the WhatsApp OTP: per address + IP, per address, and per IP (stops one visitor
  // from spraying codes at many inboxes).
  const [perPair, perEmail, perIp] = await Promise.all([
    rateLimit("email_otp", `${email}:${ip}`, 3, 15),
    rateLimit("email_otp_addr", email, 5, 60),
    rateLimit("email_otp_ip", ip, 10, 60),
  ]);
  if (!perPair.ok || !perEmail.ok || !perIp.ok)
    return { ok: false as const, error: `Too many attempts. Try again in ${Math.max(perPair.retryInMin, perEmail.retryInMin, perIp.retryInMin)} min.` };

  const code = mockMail() ? MOCK_OTP : String(randomInt(100000, 1000000));
  await db().execute("UPDATE email_otps SET used_at = NOW() WHERE email = ? AND used_at IS NULL", [email]);
  await db().execute(
    "INSERT INTO email_otps (email, code_hash, expires_at) VALUES (?, ?, NOW() + INTERVAL ? MINUTE)",
    [email, sha(code), CODE_MINUTES],
  );
  if (mockMail()) return { ok: true as const, email, devCode: MOCK_OTP };
  if (!(await sendLoginCodeEmail(email, code, CODE_MINUTES)))
    return { ok: false as const, error: "Could not send the email right now. Please try again in a minute." };
  return { ok: true as const, email };
}

/** Checks + consumes the latest code for this email. Returns the OTP row id, or an error message. */
async function consumeEmailCode(email: string, code: string): Promise<{ id: number } | { error: string }> {
  const guesses = await rateLimit("email_otp_verify", email, 10, 60);
  if (!guesses.ok) return { error: `Too many wrong attempts. Try again in ${guesses.retryInMin} min.` };
  const [[otp]] = await db().query<RowDataPacket[]>(
    "SELECT id, code_hash FROM email_otps WHERE email = ? AND used_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 1",
    [email],
  );
  if (!otp) return { error: "Invalid or expired code." };
  // Count the attempt atomically first: parallel guesses can't get past 5 per code.
  const [take] = await db().execute<ResultSetHeader>(
    "UPDATE email_otps SET attempts = attempts + 1 WHERE id = ? AND attempts < 5 AND used_at IS NULL",
    [otp.id],
  );
  if (!take.affectedRows || sha(code) !== otp.code_hash) return { error: "Invalid or expired code." };
  const [used] = await db().execute<ResultSetHeader>("UPDATE email_otps SET used_at = NOW() WHERE id = ? AND used_at IS NULL", [otp.id]);
  if (!used.affectedRows) return { error: "Invalid or expired code." };
  await resetLimit("email_otp_verify", email);
  return { id: Number(otp.id) };
}

export async function verifyEmailOtpAction(raw: unknown) {
  const parsed = z.object({ email: Email, code: z.string().regex(/^\d{6}$/) }).strict().safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Enter the 6-digit code." };
  const { email, code } = parsed.data;
  const checked = await consumeEmailCode(email, code);
  if ("error" in checked) return { ok: false as const, error: checked.error };
  const otp = checked;

  // Only an account that has proven this email signs in directly (an unverified email on a profile
  // could have been typed by someone else).
  const [[customer]] = await db().query<RowDataPacket[]>(
    "SELECT id, name FROM customers WHERE email = ? AND email_verified_at IS NOT NULL ORDER BY id LIMIT 1",
    [email],
  );
  if (customer) {
    await createCustomerSession(Number(customer.id));
    const name = String(customer.name ?? "").trim();
    return { ok: true as const, needsPhone: false, needsName: !name || /^customer$/i.test(name) };
  }

  // New shopper: hold the verified email for a few minutes while they add their mobile number.
  const token = randomBytes(32).toString("base64url");
  await db().execute(
    "UPDATE email_otps SET signup_token_hash = ?, signup_expires_at = NOW() + INTERVAL ? MINUTE WHERE id = ?",
    [sha(token), SIGNUP_MINUTES, otp.id],
  );
  (await cookies()).set(SIGNUP_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SIGNUP_MINUTES * 60,
  });
  return { ok: true as const, needsPhone: true, needsName: true };
}

export async function completeEmailSignupAction(raw: unknown) {
  const parsed = z
    .object({ phone: Phone, name: z.string().trim().max(80).optional() })
    .strict()
    .safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Enter a valid 10-digit mobile number." };
  const jar = await cookies();
  const token = jar.get(SIGNUP_COOKIE)?.value;
  if (!token) return { ok: false as const, error: "This step timed out. Please verify your email again." };
  const [[pending]] = await db().query<RowDataPacket[]>(
    "SELECT id, email FROM email_otps WHERE signup_token_hash = ? AND signup_expires_at > NOW() LIMIT 1",
    [sha(token)],
  );
  if (!pending) return { ok: false as const, error: "This step timed out. Please verify your email again." };

  const phone = cleanPhone(parsed.data.phone);
  const name = parsed.data.name && parsed.data.name.length >= 2 ? parsed.data.name : "Customer";
  const [[taken]] = await db().query<RowDataPacket[]>("SELECT id FROM customers WHERE phone = ? LIMIT 1", [phone]);
  if (taken) {
    // Same person, older account: prove the number with a WhatsApp OTP, then the email joins that
    // account (one account per shopper). Typing a number alone must never open someone's account.
    const sent = await requestCustomerOtpAction({ phone });
    if (!sent.ok) return { ok: false as const, error: sent.error ?? "Could not send the WhatsApp OTP." };
    return {
      ok: false as const,
      needsPhoneOtp: true as const,
      phone,
      devCode: "devCode" in sent ? (sent.devCode ?? "") : "",
      error: "",
    };
  }

  const [ins] = await db().execute<ResultSetHeader>(
    "INSERT IGNORE INTO customers (phone, name, email, email_verified_at) VALUES (?, ?, ?, NOW())",
    [phone, name, String(pending.email)],
  );
  if (!ins.affectedRows)
    return { ok: false as const, error: "This number already has an account. Please log in with WhatsApp, or use another number." };
  // One use only.
  await db().execute("UPDATE email_otps SET signup_token_hash = NULL, signup_expires_at = NULL WHERE id = ?", [pending.id]);
  jar.delete(SIGNUP_COOKIE);
  const [[customer]] = await db().query<RowDataPacket[]>("SELECT id FROM customers WHERE phone = ? LIMIT 1", [phone]);
  await createCustomerSession(Number(customer.id));
  return { ok: true as const, needsName: name === "Customer" };
}

/**
 * Email sign-up where the number already has an account: the WhatsApp OTP proves the number, the
 * shopper is signed in to that account and the just-verified email is saved on it.
 */
export async function linkEmailWithPhoneOtpAction(raw: unknown) {
  const parsed = z.object({ phone: Phone, code: z.string().regex(/^\d{6}$/) }).strict().safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Enter the 6-digit OTP." };
  const jar = await cookies();
  const token = jar.get(SIGNUP_COOKIE)?.value;
  const [[pending]] = token
    ? await db().query<RowDataPacket[]>(
        "SELECT id, email FROM email_otps WHERE signup_token_hash = ? AND signup_expires_at > NOW() LIMIT 1",
        [sha(token)],
      )
    : [[]];
  if (!pending) return { ok: false as const, error: "This step timed out. Please verify your email again." };

  const r = await verifyCustomerOtpAction({ phone: parsed.data.phone, code: parsed.data.code });
  if (!r.ok) return { ok: false as const, error: r.error ?? "That OTP is incorrect." };

  // Signed in to the number's account now. Save the email unless it already has another verified one.
  const phone = cleanPhone(parsed.data.phone);
  const email = String(pending.email);
  const [[usedElsewhere]] = await db().query<RowDataPacket[]>(
    "SELECT id FROM customers WHERE email = ? AND email_verified_at IS NOT NULL AND phone <> ? LIMIT 1",
    [email, phone],
  );
  if (!usedElsewhere)
    await db().execute(
      `UPDATE customers SET email = ?, email_verified_at = NOW()
       WHERE phone = ? AND (email IS NULL OR email = '' OR email_verified_at IS NULL OR email = ?)`,
      [email, phone, email],
    );
  await db().execute("UPDATE email_otps SET signup_token_hash = NULL, signup_expires_at = NULL WHERE id = ?", [pending.id]);
  jar.delete(SIGNUP_COOKIE);
  return { ok: true as const, needsName: "needsName" in r && Boolean(r.needsName) };
}

/** Signed-in shopper without an email: verify one with an emailed code and save it on the account. */
export async function attachEmailAction(raw: unknown) {
  const customer = await requireCustomer();
  const parsed = z.object({ email: Email, code: z.string().regex(/^\d{6}$/) }).strict().safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Enter the 6-digit code." };
  const { email, code } = parsed.data;
  const checked = await consumeEmailCode(email, code);
  if ("error" in checked) return { ok: false as const, error: checked.error };
  const [[other]] = await db().query<RowDataPacket[]>(
    "SELECT id FROM customers WHERE email = ? AND email_verified_at IS NOT NULL AND id <> ? LIMIT 1",
    [email, customer.id],
  );
  if (other) return { ok: false as const, error: "This email is already linked to another account." };
  await db().execute("UPDATE customers SET email = ?, email_verified_at = NOW() WHERE id = ?", [email, customer.id]);
  return { ok: true as const };
}
