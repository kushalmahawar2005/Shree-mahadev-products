import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cashfree Payment Gateway (PG API, version 2026-01-01).
 * Docs: https://www.cashfree.com/docs/api-reference/payments/latest/orders/create
 * Env: CASHFREE_ENV=sandbox|production, CASHFREE_APP_ID, CASHFREE_SECRET_KEY.
 * Our payments.txnid is used as the Cashfree order_id (unique per attempt), so every lookup is by txnid.
 */

const API_VERSION = "2026-01-01";

export function cashfreeMode(): "sandbox" | "production" {
  return process.env.CASHFREE_ENV === "production" ? "production" : "sandbox";
}

const baseUrl = () => (cashfreeMode() === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg");

export function cashfreeConfigured() {
  return Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);
}

function creds() {
  const id = process.env.CASHFREE_APP_ID;
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!id || !secret) throw new Error("CASHFREE_APP_ID / CASHFREE_SECRET_KEY are not set");
  return { id, secret };
}

async function call<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown; idempotencyKey?: string; timeoutMs?: number } = {}): Promise<T> {
  const { id, secret } = creds();
  const res = await fetch(`${baseUrl()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "x-api-version": API_VERSION,
      "x-client-id": id,
      "x-client-secret": secret,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.idempotencyKey ? { "x-idempotency-key": init.idempotencyKey } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(init.timeoutMs ?? 10_000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { message?: string; code?: string };
  if (!res.ok) {
    const err = new Error(json.message || `Cashfree HTTP ${res.status}`) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = json.code;
    throw err;
  }
  return json;
}

export type CfOrderStatus = "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED" | "TERMINATION_REQUESTED";

/** Creates the Cashfree order for one payment attempt; the session id opens the checkout popup. */
export async function createCashfreeOrder(input: {
  orderId: string; // our txnid
  amount: number;
  customerId: string;
  phone: string;
  name?: string;
  email?: string;
  returnUrl: string;
  notifyUrl?: string;
  note?: string;
}): Promise<{ paymentSessionId: string }> {
  const req = {
    method: "POST" as const,
    idempotencyKey: input.orderId, // same key on the retry: Cashfree returns the same order, never a duplicate
    timeoutMs: 15_000,
    body: {
      order_id: input.orderId,
      order_amount: input.amount,
      order_currency: "INR",
      customer_details: {
        customer_id: input.customerId,
        customer_phone: input.phone,
        ...(input.name && input.name.length >= 3 ? { customer_name: input.name.slice(0, 100) } : {}),
        ...(input.email ? { customer_email: input.email.slice(0, 100) } : {}),
      },
      order_meta: {
        return_url: input.returnUrl,
        ...(input.notifyUrl ? { notify_url: input.notifyUrl } : {}),
      },
      ...(input.note ? { order_note: input.note.slice(0, 200) } : {}),
    },
  };
  // A reused attempt (see startPaymentAttempt) already has a Cashfree order: read its session instead.
  const existing = async () => call<{ payment_session_id?: string; order_status?: string }>(`/orders/${encodeURIComponent(input.orderId)}`);
  // One retry on a timeout / network error or a 5xx (a slow first connection was seen in dev).
  let data: { payment_session_id?: string };
  try {
    data = await call<{ payment_session_id?: string }>("/orders", req);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 409 || status === 422) data = await existing();
    else if (status && status < 500) throw e;
    else data = await call<{ payment_session_id?: string }>("/orders", req);
  }
  if (!data.payment_session_id) throw new Error("Cashfree did not return a payment session");
  return { paymentSessionId: data.payment_session_id };
}

/** Order status straight from Cashfree (never trust the browser or webhook body alone). Null = unreachable / unknown. */
export async function getCashfreeOrder(orderId: string): Promise<{ status: CfOrderStatus; amount: number } | null> {
  try {
    const o = await call<{ order_status?: CfOrderStatus; order_amount?: number }>(`/orders/${encodeURIComponent(orderId)}`);
    return o.order_status ? { status: o.order_status, amount: Number(o.order_amount) } : null;
  } catch (e) {
    if ((e as { status?: number }).status === 404) return { status: "TERMINATED", amount: 0 };
    return null;
  }
}

export type CfPayment = { id: string; status: string; amount: number; group?: string; message?: string };

export async function getCashfreePayments(orderId: string): Promise<CfPayment[] | null> {
  try {
    const list = await call<{ cf_payment_id?: string | number; payment_status?: string; payment_amount?: number; payment_group?: string; payment_message?: string }[]>(
      `/orders/${encodeURIComponent(orderId)}/payments`,
    );
    return (Array.isArray(list) ? list : []).map((p) => ({
      id: String(p.cf_payment_id ?? ""),
      status: String(p.payment_status ?? ""),
      amount: Number(p.payment_amount),
      group: p.payment_group,
      message: p.payment_message,
    }));
  } catch {
    return null;
  }
}

/** Refund (full or partial). Same shape as the PayU refund result so refunds.ts can treat both alike. */
export async function requestCashfreeRefund(orderId: string, refundId: string, amount: number, note?: string): Promise<{ ok: boolean; ref?: string; message: string; uncertain?: boolean }> {
  try {
    const r = await call<{ cf_refund_id?: string | number; refund_status?: string; status_description?: string }>(`/orders/${encodeURIComponent(orderId)}/refunds`, {
      method: "POST",
      idempotencyKey: refundId,
      timeoutMs: 15_000,
      body: {
        refund_amount: amount,
        refund_id: refundId,
        ...(note && note.length >= 3 ? { refund_note: note.slice(0, 100) } : {}),
      },
    });
    const status = String(r.refund_status ?? "");
    const ok = ["SUCCESS", "PENDING", "PENDING_APPROVAL", "ONHOLD"].includes(status);
    return { ok, ref: r.cf_refund_id ? String(r.cf_refund_id) : undefined, message: ok ? `Refund ${status.toLowerCase().replace("_", " ")}` : r.status_description || `Cashfree refund ${status || "failed"}` };
  } catch (e) {
    const status = (e as { status?: number }).status;
    // No HTTP status = timeout / network: Cashfree may have taken it. Callers must not treat this as a failure.
    if (!status || status >= 500) return { ok: false, uncertain: true, message: (e as Error).message };
    return { ok: false, message: (e as Error).message };
  }
}

/**
 * Webhook signature: base64(HMAC-SHA256(secret, timestamp + rawBody)).
 * Cashfree's pseudocode shows a "." between the two while its code samples don't, so accept either.
 */
export function verifyCashfreeSignature(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  if (!timestamp || !signature) return false;
  const { secret } = creds();
  const got = Buffer.from(signature);
  return [`${timestamp}${rawBody}`, `${timestamp}.${rawBody}`].some((msg) => {
    const want = Buffer.from(createHmac("sha256", secret).update(msg).digest("base64"));
    return want.length === got.length && timingSafeEqual(want, got);
  });
}
