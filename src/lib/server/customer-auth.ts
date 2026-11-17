import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "./db";

const COOKIE = "smp_customer";
/** Non-secret "signed in" flag the browser can read (UI only; every real check uses COOKIE). */
const SIGNED_IN_HINT = "smp_in";
const DAYS = 30;
const secret = () => {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (s) return s;
  // A known fallback would let anyone forge sessions: only allowed in local development.
  if (process.env.NODE_ENV === "production") throw new Error("ADMIN_SESSION_SECRET is not set");
  return "development-only-change-me";
};
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const sign = (value: string) => createHmac("sha256", secret()).update(value).digest("base64url");
const cleanPhone = (value: string) => value.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");

export async function createCustomerSession(customerId: number) {
  const raw = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + DAYS * 86400000);
  const h = await headers();
  // Device info for "Active sessions" on the profile page.
  await db().execute(
    "INSERT INTO customer_sessions (customer_id, token_hash, expires_at, user_agent, ip, last_seen_at) VALUES (?,?,?,?,?,NOW())",
    [customerId, hash(raw), expires, h.get("user-agent")?.slice(0, 255) ?? null, h.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 45) || null],
  );
  // Signing in again cancels a pending account deletion (7-day grace period).
  await db().execute("UPDATE customers SET last_login_at=NOW(), delete_requested_at=NULL WHERE id=?", [customerId]);
  const value = `${raw}.${sign(raw)}`;
  const jar = await cookies();
  jar.set(COOKIE, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires });
  // Readable hint (no secret in it) so the header can show "Account" instead of the "Login" nudge.
  jar.set(SIGNED_IN_HINT, "1", { httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires });
}

export async function getCustomerSession() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const [raw, signature] = value.split(".");
  if (!raw || !signature || sign(raw) !== signature) return null;
  const [[row]] = await db().query<RowDataPacket[]>(
    `SELECT c.id, c.phone, c.name, c.email FROM customer_sessions s
     JOIN customers c ON c.id=s.customer_id
     WHERE s.token_hash=? AND s.expires_at > NOW()`,
    [hash(raw)],
  );
  return row ? { id: Number(row.id), phone: String(row.phone), name: String(row.name), email: String(row.email ?? "") } : null;
}

export async function requireCustomer() {
  const session = await getCustomerSession();
  if (!session) throw new Error("Please sign in first.");
  return session;
}

export async function clearCustomerSession() {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE)?.value;
  if (value) {
    const [raw] = value.split(".");
    if (raw) await db().execute("DELETE FROM customer_sessions WHERE token_hash=?", [hash(raw)]);
  }
  cookieStore.delete(COOKIE);
  cookieStore.delete(SIGNED_IN_HINT);
}

export { cleanPhone };
