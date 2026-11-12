"use server";

import { createHash, randomInt } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { db } from "@/lib/server/db";
import { findDuplicateAddress } from "@/lib/server/account-addresses";
import { addToCartAction } from "@/lib/commerce/actions";
import {
  cleanPhone,
  clearCustomerSession,
  createCustomerSession,
  requireCustomer,
} from "@/lib/server/customer-auth";
import { setOrderStatus } from "@/lib/server/orders";

const Phone = z.string().regex(/^(?:\+?91|0)?[6-9]\d{9}$/);
const normalized = (value: string) => cleanPhone(Phone.parse(value));

/** OTP gateway settings, or null while the client has not set one up yet. */
function otpGateway() {
  const url = process.env.CUSTOMER_OTP_API_URL;
  const key = process.env.CUSTOMER_OTP_API_KEY;
  return url && key ? { url, key } : null;
}

/**
 * Mock OTP for local development only: while no gateway is set and the app is not a production
 * build (`pnpm dev`), the code is fixed and returned to the page so the flow can be tested.
 * Never active on a deployed site: a known code would let anyone sign in as any number.
 */
const MOCK_OTP = "123456";
const otpMock = () => !otpGateway() && process.env.NODE_ENV !== "production";

/** Sends the code. Returns false on any failure, so callers show a message instead of crashing the page. */
async function sendOtp(phone: string, code: string): Promise<boolean> {
  const gw = otpGateway();
  if (!gw) return false;
  const { url, key } = gw;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: process.env.CUSTOMER_OTP_PROVIDER,
        phone,
        otp: code,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function requestCustomerOtpAction(raw: unknown) {
  const parsed = z.object({ phone: Phone }).strict().safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: "Enter a valid Indian mobile number." };
  // No gateway yet (and not local dev): say so plainly, guest checkout still works, and skip writing a code nobody receives.
  const mock = otpMock();
  if (!otpGateway() && !mock)
    return {
      ok: false,
      error:
        "Mobile login is coming soon. You can still order as a guest: just add to cart and check out.",
    };
  const phone = normalized(parsed.data.phone);
  const limit = await rateLimit(
    "customer_otp",
    `${phone}:${await clientIp()}`,
    3,
    15,
  );
  if (!limit.ok)
    return {
      ok: false,
      error: `Too many attempts. Try again in ${limit.retryInMin} min.`,
    };
  const code = mock ? MOCK_OTP : String(randomInt(100000, 1000000));
  await db().execute(
    "UPDATE otp_codes SET used_at=NOW() WHERE phone=? AND used_at IS NULL",
    [phone],
  );
  await db().execute(
    "INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL 5 MINUTE))",
    [phone, createHash("sha256").update(code).digest("hex")],
  );
  if (mock) return { ok: true, phone, devCode: MOCK_OTP };
  if (!(await sendOtp(phone, code)))
    return {
      ok: false,
      error: "Could not send the OTP right now. Please try again in a minute.",
    };
  return { ok: true, phone };
}

export async function verifyCustomerOtpAction(raw: unknown) {
  const parsed = z
    .object({
      phone: Phone,
      code: z.string().regex(/^\d{6}$/),
      name: z.string().trim().min(2).max(120).optional(),
      email: z.string().email().max(160).optional(),
    })
    .strict()
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Enter the 6-digit OTP." };
  const phone = normalized(parsed.data.phone);
  const [[otp]] = await db().query<RowDataPacket[]>(
    "SELECT id, code_hash, attempts FROM otp_codes WHERE phone=? AND used_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 1",
    [phone],
  );
  if (
    !otp ||
    Number(otp.attempts) >= 5 ||
    createHash("sha256").update(parsed.data.code).digest("hex") !==
      otp.code_hash
  ) {
    if (otp)
      await db().execute(
        "UPDATE otp_codes SET attempts=attempts+1 WHERE id=?",
        [otp.id],
      );
    return { ok: false, error: "Invalid or expired OTP." };
  }
  await db().execute("UPDATE otp_codes SET used_at=NOW() WHERE id=?", [otp.id]);
  await db().execute(
    "INSERT INTO customers (phone, name, email) VALUES (?,?,?) ON DUPLICATE KEY UPDATE name=COALESCE(NULLIF(VALUES(name),''),name), email=COALESCE(VALUES(email),email), id=LAST_INSERT_ID(id)",
    [phone, parsed.data.name ?? "Customer", parsed.data.email ?? null],
  );
  const [[customer]] = await db().query<RowDataPacket[]>(
    "SELECT LAST_INSERT_ID() AS id",
  );
  await createCustomerSession(Number(customer.id));
  return { ok: true };
}

export async function logoutCustomerAction() {
  await clearCustomerSession();
  redirect("/");
}

export async function saveCustomerAddressAction(raw: unknown) {
  const customer = await requireCustomer();
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(120),
      phone: Phone,
      line1: z.string().trim().min(3).max(255),
      line2: z.string().trim().max(255).optional(),
      city: z.string().trim().min(2).max(80),
      state: z.string().trim().min(2).max(60),
      pincode: z.string().regex(/^[1-9]\d{5}$/),
    })
    .strict()
    .parse(raw);
  // Already in the address book: nothing to add.
  if (await findDuplicateAddress(db(), customer.id, { ...parsed, phone: normalized(parsed.phone) }))
    return { ok: true };
  await db().execute(
    "INSERT INTO addresses (customer_id,name,phone,line1,line2,city,state,pincode) VALUES (?,?,?,?,?,?,?,?)",
    [
      customer.id,
      parsed.name,
      normalized(parsed.phone),
      parsed.line1,
      parsed.line2 ?? null,
      parsed.city,
      parsed.state,
      parsed.pincode,
    ],
  );
  return { ok: true };
}

export async function reorderAction(orderId: number) {
  const customer = await requireCustomer();
  if (!Number.isInteger(orderId) || orderId <= 0)
    throw new Error("Invalid order.");
  const [items] = await db().query<RowDataPacket[]>(
    "SELECT oi.variant_key, oi.quantity FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.order_id=? AND o.customer_id=?",
    [orderId, customer.id],
  );
  for (const item of items) {
    try {
      await addToCartAction(String(item.variant_key), Number(item.quantity));
    } catch (error) {
      console.error("Could not reorder line", item.variant_key, error);
    }
  }
  return { ok: true, added: items.length };
}

const CANCEL_REASONS = [
  "Ordered by mistake",
  "Want to change items or address",
  "Found a better price",
  "Delivery is too slow",
  "Other",
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

/**
 * Shopper cancels their own order: only unpaid ones, or confirmed/packed ones before shipping.
 * Status changes go through setOrderStatus (order_events + restock + notifications).
 */
export async function cancelMyOrderAction(raw: unknown) {
  const customer = await requireCustomer();
  const parsed = z
    .object({
      orderId: z.number().int().positive(),
      reason: z.enum(CANCEL_REASONS),
    })
    .strict()
    .safeParse(raw);
  if (!parsed.success)
    return { ok: false as const, error: "Please choose a reason." };
  const [[o]] = await db().query<RowDataPacket[]>(
    "SELECT status, payment_method FROM orders WHERE id=? AND customer_id=?",
    [parsed.data.orderId, customer.id],
  );
  if (!o) return { ok: false as const, error: "Order not found." };
  const status = String(o.status);
  if (
    !["pending_payment", "cod_pending", "confirmed", "packed", "paid"].includes(
      status,
    )
  )
    return {
      ok: false as const,
      error:
        "This order has already shipped, so it can't be cancelled here. Message us on WhatsApp.",
    };
  // Paid online orders need a refund: the team handles those, so flag instead of cancelling silently.
  if (status === "paid" && String(o.payment_method) === "payu")
    return {
      ok: false as const,
      error:
        "This order is paid. Message us on WhatsApp and we'll cancel it and refund you.",
    };
  await setOrderStatus(
    parsed.data.orderId,
    "cancelled",
    "customer",
    `Cancelled by customer: ${parsed.data.reason}`,
  );
  return { ok: true as const };
}
