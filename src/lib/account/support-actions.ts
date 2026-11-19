"use server";

import type { RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { hasActiveShipment } from "@/lib/server/orders";
import {
  ISSUES,
  ISSUE_KEYS,
  PHOTO_ISSUES,
  VIDEO_ISSUES,
  cancelRule,
  isSupportVideo,
  issuesFor,
  type HelpOrderDetail,
} from "@/components/account/help/help-lib";
import { supportConfig } from "@/config/support";
import { buildFaqs } from "@/content/faqs";
import { site, whatsappLink } from "@/data/site";
import { cancelReason } from "@/lib/account/order-ui";
import { getAccountOrder } from "@/lib/server/account";
import { requireCustomer } from "@/lib/server/customer-auth";
import { db } from "@/lib/server/db";
import { rateLimit } from "@/lib/server/rate-limit";
import {
  createSupportTicket,
  queueSupportAlert,
  recordFaqFeedback,
  signSupportUpload,
  verifySupportPhoto,
} from "@/lib/server/support-tickets";
import { DEFAULT_SETTINGS } from "@/lib/store-settings";
import { formatPhone } from "@/lib/utils/format";

const fail = (error: string) => ({ ok: false as const, error });

/** Everything the help flow shows for one of this customer's orders (shortcuts in step 2). */
export async function getHelpOrderAction(raw: unknown) {
  const customer = await requireCustomer();
  const p = z.object({ orderId: z.number().int().positive() }).strict().safeParse(raw);
  if (!p.success) return fail("Invalid order.");
  const o = await getAccountOrder(customer.id, p.data.orderId);
  if (!o) return fail("Order not found.");
  const scan = o.tracking[0];
  const detail: HelpOrderDetail = {
    id: o.id,
    orderNo: o.orderNo,
    status: o.status,
    method: o.method,
    eta: o.eta,
    courier: o.courier,
    awb: o.awb,
    trackingUrl: o.trackingUrl && /^https:\/\//.test(o.trackingUrl) ? o.trackingUrl : null,
    lastScan: scan ? { status: scan.status, location: scan.location, at: scan.at } : null,
    refunds: o.refunds,
    cancelReason: o.status === "cancelled" ? cancelReason(o) : null,
    canCancel: cancelRule(o.status, o.method, await hasActiveShipment(o.id)),
    returnDaysLeft: o.returnDaysLeft,
    returnRequested: Boolean(o.returnRequest),
  };
  return { ok: true as const, order: detail };
}

/** Signed direct-upload params for one help photo or unboxing video (browser → Cloudinary). */
export async function signSupportPhotoUploadAction(kind: unknown = "image") {
  const customer = await requireCustomer();
  const k = kind === "video" ? "video" : "image";
  const limit = await rateLimit("support_upload", String(customer.id), 15, 60);
  if (!limit.ok) return fail(`Too many uploads. Try again in ${limit.retryInMin} min.`);
  try {
    const s = signSupportUpload(k);
    if (!s) return fail("Uploads aren't available right now. Please try again later.");
    return { ok: true as const, ...s };
  } catch (e) {
    console.error("signSupportPhotoUploadAction", e);
    return fail("Could not prepare the photo upload.");
  }
}

async function verifyAttachments(list: { url: string; publicId: string }[]) {
  for (const ph of list) {
    const err = await verifySupportPhoto(ph);
    if (err) return err;
  }
  return null;
}

const TicketInput = z
  .object({
    orderId: z.number().int().positive().nullable(),
    issue: z.enum(ISSUE_KEYS),
    message: z.string().trim().max(supportConfig.messageMax, `Keep the message under ${supportConfig.messageMax} characters.`),
    utr: z
      .string()
      .trim()
      .max(40)
      .regex(/^[A-Za-z0-9-]*$/, "UPI / UTR reference: letters and numbers only.")
      .optional(),
    contactPref: z.enum(["whatsapp", "call"]),
    callbackSlot: z.enum(supportConfig.callbackSlots).optional(),
    photos: z
      .array(z.object({ url: z.string().url().max(500), publicId: z.string().min(1).max(200) }).strict())
      .max(supportConfig.photos.max + supportConfig.video.max),
  })
  .strict()
  .refine((v) => v.photos.filter((p) => isSupportVideo(p.url)).length <= supportConfig.video.max, { message: "Add only one video.", path: ["photos"] })
  .refine((v) => v.photos.filter((p) => !isSupportVideo(p.url)).length <= supportConfig.photos.max, { message: `Add up to ${supportConfig.photos.max} photos.`, path: ["photos"] })
  .refine((v) => !VIDEO_ISSUES.includes(v.issue) || v.photos.some((p) => isSupportVideo(p.url)), {
    message: "Please add your unboxing video. Damage and expiry claims need it.",
    path: ["photos"],
  })
  .refine((v) => v.contactPref !== "call" || v.callbackSlot, { message: "Pick a time for the call back.", path: ["callbackSlot"] })
  .refine((v) => v.message.length > 0 || v.issue !== "other", { message: "Tell us a little about the problem.", path: ["message"] })
  .refine((v) => v.issue !== "callback" || v.contactPref === "call", { message: "Pick a time for the call back.", path: ["callbackSlot"] });

/**
 * Create a help request: saved in the DB first, then the store is alerted by email (outbox).
 * Returns the WhatsApp link (prefilled with the ticket) for the WhatsApp contact preference.
 */
export async function submitSupportTicketAction(raw: unknown) {
  const customer = await requireCustomer();
  const p = TicketInput.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Please check the form.");
  const input = p.data;

  const limit = await rateLimit("support_ticket", String(customer.id), supportConfig.ticketsPerHour, 60);
  if (!limit.ok) return fail(`You've sent several requests already. Try again in ${limit.retryInMin} min, or message us on WhatsApp.`);

  let orderNo: string | null = null;
  if (input.orderId) {
    const [[o]] = await db().query<RowDataPacket[]>("SELECT order_no, status FROM orders WHERE id=? AND customer_id=?", [
      input.orderId,
      customer.id,
    ]);
    if (!o) return fail("Order not found.");
    if (input.issue !== "callback" && !issuesFor(String(o.status)).includes(input.issue)) return fail("Please pick the issue again.");
    orderNo = String(o.order_no ?? input.orderId);
  } else if (input.issue !== "callback" && !issuesFor(null).includes(input.issue)) return fail("Please pick the issue again.");

  const photos = PHOTO_ISSUES.includes(input.issue) ? input.photos : [];
  const err = await verifyAttachments(photos);
  if (err) return fail(err);
  const utr = input.issue === "money_deducted" && input.utr ? input.utr : null;
  const callbackSlot = input.contactPref === "call" ? (input.callbackSlot ?? null) : null;

  const { id, ticketNo } = await createSupportTicket({
    customerId: customer.id,
    orderId: input.orderId,
    issue: input.issue,
    message: input.message,
    utr,
    contactPref: input.contactPref,
    callbackSlot,
    photos,
  });
  await queueSupportAlert({
    ticketId: id,
    ticketNo,
    customer: { name: customer.name, phone: customer.phone },
    orderId: input.orderId,
    orderNo,
    issue: input.issue,
    message: input.message,
    utr,
    contactPref: input.contactPref,
    callbackSlot,
    photos: photos.map((x) => x.url),
  });

  const photoLink = photos[0]?.url ?? (photos.length ? `${site.url}/account/help?ticket=${ticketNo}` : null);
  const text = [
    `Hi, ticket ${ticketNo}`,
    orderNo ? `Order #${orderNo}` : null,
    `Issue: ${ISSUES[input.issue]}`,
    input.message || null,
    utr ? `UTR: ${utr}` : null,
    photoLink ? `Photos: ${photoLink}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    ok: true as const,
    ticket: {
      id,
      ticketNo,
      orderId: input.orderId,
      orderNo,
      issue: input.issue,
      message: input.message,
      utr,
      contactPref: input.contactPref,
      callbackSlot,
      status: "open",
      createdAt: new Date().toISOString(),
      photos: photos.map((x) => x.url),
    },
    whatsappUrl: whatsappLink(text),
    phone: formatPhone(customer.phone),
  };
}

const FAQ_IDS = new Set(buildFaqs(DEFAULT_SETTINGS.shipping).map((f) => f.id));

/** 👍 / 👎 on a help answer (once per browser is enforced client-side; server rate-limits). */
export async function faqFeedbackAction(raw: unknown) {
  const customer = await requireCustomer();
  const p = z.object({ id: z.string().max(80), helpful: z.boolean() }).strict().safeParse(raw);
  if (!p.success || !FAQ_IDS.has(p.data.id)) return fail("Unknown question.");
  const limit = await rateLimit("faq_feedback", String(customer.id), 40, 60);
  if (!limit.ok) return { ok: true as const }; // silently ignore floods
  await recordFaqFeedback(p.data.id, p.data.helpful);
  return { ok: true as const };
}
