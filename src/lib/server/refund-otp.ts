import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "./db";
import { mailConfigured, sendRefundOtpEmail } from "./mail";

const MINUTES = 10;
const DEFAULT_TO = "info.mahadevproducts@gmail.com";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Inbox that approves refunds. Set REFUND_OTP_EMAIL to move it. */
export const refundOtpEmail = () => process.env.REFUND_OTP_EMAIL?.trim() || DEFAULT_TO;

const mask = (email: string) => email.replace(/^(.{2})[^@]*(@.*)$/, "$1•••$2");

/** Emails a fresh code for this order + amount. Older open codes for the same order stop working. */
export async function sendRefundOtp(orderId: number, amount: number, adminUser: string) {
  const [[order]] = await db().query<RowDataPacket[]>("SELECT order_no FROM orders WHERE id = ?", [orderId]);
  if (!order) throw new Error("Order not found");
  const orderNo = String(order.order_no);
  const dev = !mailConfigured() && process.env.NODE_ENV !== "production";
  if (!mailConfigured() && !dev) throw new Error("Email is not set up, so the refund code can't be sent.");
  const code = dev ? "123456" : String(randomInt(100000, 1000000));
  await db().execute("UPDATE refund_otps SET used_at = NOW() WHERE order_id = ? AND used_at IS NULL", [orderId]);
  await db().execute(
    "INSERT INTO refund_otps (order_id, amount, admin_user, code_hash, expires_at) VALUES (?,?,?,?, NOW() + INTERVAL ? MINUTE)",
    [orderId, amount, adminUser, sha(code), MINUTES],
  );
  const to = refundOtpEmail();
  if (!dev && !(await sendRefundOtpEmail(to, code, { orderNo, amount, by: adminUser, minutes: MINUTES })))
    throw new Error("Could not send the refund code email. Try again in a minute.");
  return { sentTo: mask(to), minutes: MINUTES };
}

/** Checks and burns the code. Throws a readable error when it doesn't match this order + amount. */
export async function consumeRefundOtp(orderId: number, amount: number, adminUser: string, code: string) {
  const bad = new Error("Wrong or expired code. Send a new code and try again.");
  if (!/^\d{6}$/.test(code)) throw bad;
  const [[otp]] = await db().query<RowDataPacket[]>(
    "SELECT id, amount, code_hash FROM refund_otps WHERE order_id = ? AND admin_user = ? AND used_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 1",
    [orderId, adminUser],
  );
  if (!otp) throw bad;
  // Count the guess first, atomically, so parallel tries can't get past 5.
  const [take] = await db().execute<ResultSetHeader>(
    "UPDATE refund_otps SET attempts = attempts + 1 WHERE id = ? AND attempts < 5 AND used_at IS NULL",
    [otp.id],
  );
  const match = timingSafeEqual(Buffer.from(sha(code)), Buffer.from(String(otp.code_hash)));
  if (!take.affectedRows || !match) throw bad;
  if (Number(otp.amount) !== amount) throw new Error("The amount changed after the code was sent. Send a new code for this amount.");
  const [used] = await db().execute<ResultSetHeader>("UPDATE refund_otps SET used_at = NOW() WHERE id = ? AND used_at IS NULL", [otp.id]);
  if (!used.affectedRows) throw bad;
}
