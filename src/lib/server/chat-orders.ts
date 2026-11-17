import "server-only";

import { createHash, createHmac, randomInt } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { cookies } from "next/headers";
import { z } from "zod";
import { cleanPhone } from "@/lib/server/customer-auth";
import { db } from "@/lib/server/db";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { otpConfigured, sendOtpCode } from "@/lib/server/otp-sender";

const COOKIE = "smp_chat_order_access";
const Phone = z.string().regex(/^(?:\+?91|0)?[6-9]\d{9}$/);
const normalizePhone = (phone: string) => cleanPhone(Phone.parse(phone));
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const secret = () => process.env.ADMIN_SESSION_SECRET || "development-only-change-me";
const sign = (value: string) => createHmac("sha256", secret()).update(value).digest("base64url");
const mockOtp = () => !otpConfigured() && process.env.NODE_ENV !== "production";

async function sendOtp(phone: string, code: string) {
  return otpConfigured() ? sendOtpCode(phone, code) : mockOtp();
}

export async function requestGuestChatOrderOtp(raw: unknown) {
  const parsed = z.object({ orderNo: z.string().trim().toUpperCase().min(5).max(32), phone: Phone }).strict().safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Enter the order number and the 10-digit phone used at checkout." };

  const phone = normalizePhone(parsed.data.phone);
  const limit = await rateLimit("chat_guest_otp", `${phone}:${await clientIp()}`, 3, 15);
  if (!limit.ok) return { ok: false as const, error: `Too many attempts. Try again in ${limit.retryInMin} min.` };

  const [[order]] = await db().query<RowDataPacket[]>(
    "SELECT id FROM orders WHERE order_no=? AND phone=? LIMIT 1",
    [parsed.data.orderNo, phone],
  );
  // Avoid confirming whether an order number or phone exists.
  if (!order) return { ok: true as const, message: "If these details match an order, a verification code has been sent." };

  const isMock = mockOtp();
  if (!isMock && !otpConfigured()) {
    return { ok: false as const, error: "Guest verification is not available right now. Use the secure tracking link or contact support." };
  }
  const code = isMock ? "123456" : String(randomInt(100000, 1000000));
  await db().execute("UPDATE chat_guest_otps SET used_at=NOW() WHERE phone=? AND used_at IS NULL", [phone]);
  await db().execute(
    "INSERT INTO chat_guest_otps (phone, code_hash, expires_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL 5 MINUTE))",
    [phone, hash(code)],
  );
  if (!(await sendOtp(phone, code))) return { ok: false as const, error: "Could not send the code. Please try again or use your tracking link." };
  return { ok: true as const, message: "If these details match an order, a verification code has been sent.", devCode: isMock ? code : undefined };
}

export async function verifyGuestChatOrderOtp(raw: unknown) {
  const parsed = z.object({ phone: Phone, code: z.string().regex(/^\d{6}$/) }).strict().safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Enter the 6-digit verification code." };
  const phone = normalizePhone(parsed.data.phone);
  const attemptLimit = await rateLimit("chat_guest_otp_verify", `${phone}:${await clientIp()}`, 10, 15);
  if (!attemptLimit.ok) return { ok: false as const, error: `Too many attempts. Try again in ${attemptLimit.retryInMin} min.` };
  const [[otp]] = await db().query<RowDataPacket[]>(
    "SELECT id, code_hash, attempts FROM chat_guest_otps WHERE phone=? AND used_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 1",
    [phone],
  );
  if (!otp || Number(otp.attempts) >= 5 || hash(parsed.data.code) !== String(otp.code_hash)) {
    if (otp) await db().execute("UPDATE chat_guest_otps SET attempts=attempts+1 WHERE id=?", [otp.id]);
    return { ok: false as const, error: "That code is invalid or expired. Request a new code and try again." };
  }
  await db().execute("UPDATE chat_guest_otps SET used_at=NOW() WHERE id=?", [otp.id]);
  const expiresAt = Date.now() + 30 * 60_000;
  const payload = `${phone}.${expiresAt}`;
  const cookie = await cookies();
  cookie.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/chat",
    expires: new Date(expiresAt),
  });
  return { ok: true as const };
}

export async function getGuestChatOrderPhone() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [phone, expiry, signature] = parts;
  const payload = `${phone}.${expiry}`;
  if (!/^[6-9]\d{9}$/.test(phone) || !/^\d+$/.test(expiry) || Number(expiry) <= Date.now() || sign(payload) !== signature) return null;
  return phone;
}

export async function clearGuestChatOrderAccess() {
  (await cookies()).delete(COOKIE);
}
