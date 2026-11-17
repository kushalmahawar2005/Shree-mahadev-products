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
import { otpConfigured, sendOtpCode } from "@/lib/server/otp-sender";
import { hasActiveShipment, setOrderStatus } from "@/lib/server/orders";

const Phone = z.string().regex(/^(?:\+?91|0)?[6-9]\d{9}$/);
const normalized = (value: string) => cleanPhone(Phone.parse(value));

/**
 * Mock OTP for local development only: while no gateway is set and the app is not a production
 * build (`pnpm dev`), the code is fixed and returned to the page so the flow can be tested.
 * Never active on a deployed site: a known code would let anyone sign in as any number.
 */
const MOCK_OTP = "123456";
const otpMock = () => !otpConfigured() && process.env.NODE_ENV !== "production";

/**
 * Test numbers for the live site while no OTP gateway is set up: CUSTOMER_OTP_TEST_PHONES is a
 * comma-separated list of 10-digit numbers (the owner's / staff phones). Only those numbers can sign
 * in with the fixed code; every other number still gets "Mobile login is coming soon".
 * Remove the variable once the real gateway works.
 */
function isTestPhone(phone: string) {
  const list = (process.env.CUSTOMER_OTP_TEST_PHONES ?? "")
    .split(",")
    .map((p) => p.replace(/\D/g, "").slice(-10))
    .filter((p) => p.length === 10);
  return list.includes(phone.replace(/\D/g, "").slice(-10));
}

export async function requestCustomerOtpAction(raw: unknown) {
  const parsed = z.object({ phone: Phone }).strict().safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: "Enter a valid Indian mobile number." };
  // No gateway yet (and not local dev / a test number): say so plainly, guest checkout still works, and skip writing a code nobody receives.
  const mock = otpMock() || (!otpConfigured() && isTestPhone(cleanPhone(parsed.data.phone)));
  if (!otpConfigured() && !mock)
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
  if (!(await sendOtpCode(phone, code)))
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
      // Optional and may be "" (the name is asked after sign-in, only for new accounts).
      name: z.string().trim().max(120).optional(),
      email: z.string().email().max(160).optional(),
    })
    .strict()
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Enter the 6-digit OTP." };
  const givenName = parsed.data.name && parsed.data.name.length >= 2 ? parsed.data.name : null;
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
    [phone, givenName ?? "Customer", parsed.data.email ?? null],
  );
  const [[customer]] = await db().query<RowDataPacket[]>(
    // By phone, not LAST_INSERT_ID(): db() is a pool, so a second query may run on another connection.
    "SELECT id, name FROM customers WHERE phone=? LIMIT 1",
    [phone],
  );
  await createCustomerSession(Number(customer.id));
  // First sign-in (or an account created without a real name): the page asks for the name next.
  const name = String(customer.name ?? "").trim();
  return { ok: true, needsName: !name || name === "Customer" };
}

/** Saves the shopper's name right after their first sign-in. */
export async function setCustomerNameAction(raw: unknown) {
  const customer = await requireCustomer();
  const parsed = z.object({ name: z.string().trim().min(2).max(80) }).strict().safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Please enter your name (at least 2 letters)." };
  await db().execute("UPDATE customers SET name=? WHERE id=?", [parsed.data.name, customer.id]);
  return { ok: true as const };
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

/**
 * Adds a past order's items to the cart at today's prices and stock. Returns what was added,
 * what was skipped (unavailable) and what now costs a different price, so the shopper sees it.
 */
export async function reorderAction(orderId: number) {
  const customer = await requireCustomer();
  if (!Number.isInteger(orderId) || orderId <= 0)
    throw new Error("Invalid order.");
  const [items] = await db().query<RowDataPacket[]>(
    "SELECT oi.variant_key, oi.quantity, oi.product_title, oi.variant_title, oi.unit_price FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.order_id=? AND o.customer_id=?",
    [orderId, customer.id],
  );
  const added: string[] = [];
  const skipped: string[] = [];
  const repriced: { item: string; was: number; now: number }[] = [];
  for (const item of items) {
    const label = `${item.product_title} (${item.variant_title})`;
    try {
      const cart = await addToCartAction(String(item.variant_key), Number(item.quantity));
      const line = cart?.lines.find((l) => l.variant.id === String(item.variant_key));
      if (!line) { skipped.push(label); continue; }
      added.push(label);
      const now = Number(line.variant.price.amount);
      if (now !== Number(item.unit_price)) repriced.push({ item: label, was: Number(item.unit_price), now });
    } catch (error) {
      console.error("Could not reorder line", item.variant_key, error);
      skipped.push(label);
    }
  }
  return { ok: true, added: added.length, addedItems: added, skipped, repriced };
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
  const limit = await rateLimit("cancel_order", String(customer.id), 5, 10);
  if (!limit.ok)
    return { ok: false as const, error: `Too many attempts. Try again in ${limit.retryInMin} min.` };
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
  // Once the courier shipment is created the parcel is with logistics: no self-cancel after that.
  if (await hasActiveShipment(parsed.data.orderId))
    return {
      ok: false as const,
      error:
        "This order is already booked with the courier, so it can't be cancelled here. Message us on WhatsApp.",
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
