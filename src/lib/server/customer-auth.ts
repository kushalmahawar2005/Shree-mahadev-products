import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2/promise";
import { db } from "./db";

const COOKIE = "smp_customer";
const DAYS = 30;
const secret = () => process.env.ADMIN_SESSION_SECRET || "development-only-change-me";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const sign = (value: string) => createHmac("sha256", secret()).update(value).digest("base64url");
const cleanPhone = (value: string) => value.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");

export async function createCustomerSession(customerId: number) {
  const raw = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + DAYS * 86400000);
  await db().execute("INSERT INTO customer_sessions (customer_id, token_hash, expires_at) VALUES (?,?,?)", [customerId, hash(raw), expires]);
  const value = `${raw}.${sign(raw)}`;
  (await cookies()).set(COOKIE, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires });
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
}

export { cleanPhone };
