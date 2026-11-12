"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProduct } from "@/lib/commerce";
import { getCartAction } from "@/lib/commerce/actions";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { requireAdmin } from "@/lib/server/admin-auth";
import { db } from "@/lib/server/db";
import { calculateCoupon } from "@/lib/server/coupons";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

const CouponInput = z
  .object({
    id: z.number().int().positive().nullable(),
    code: z
      .string()
      .trim()
      .min(3)
      .max(30)
      .regex(/^[A-Za-z0-9_-]+$/)
      .transform((v) => v.toUpperCase()),
    kind: z.enum(["percent", "flat", "free_shipping"]),
    value: z.number().int().min(0).max(100_000),
    minSubtotal: z.number().int().min(0).max(100_000_000),
    maxDiscount: z.number().int().min(1).max(100_000_000).nullable(),
    firstOrderOnly: z.boolean(),
    usageLimit: z.number().int().min(1).nullable(),
    perPhoneLimit: z.number().int().min(1).nullable(),
    startsAt: z.string().max(16),
    endsAt: z.string().max(16),
    active: z.boolean(),
    targets: z
      .array(
        z
          .object({
            kind: z.enum(["product", "collection"]),
            handle: z.string().trim().min(1).max(100),
          })
          .strict(),
      )
      .max(200),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.kind === "percent" && (v.value < 1 || v.value > 100))
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Percentage must be between 1 and 100.",
      });
    if (v.kind === "flat" && v.value < 1)
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Enter a discount amount.",
      });
    if (v.kind === "free_shipping" && v.value !== 0)
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Free shipping coupons don't use a value.",
      });
    if (v.startsAt && v.endsAt && v.startsAt >= v.endsAt)
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "End date must be after the start date.",
      });
  });

export async function saveCouponAction(raw: unknown) {
  const admin = await requireAdmin();
  const p = CouponInput.safeParse(raw);
  if (!p.success)
    return {
      ok: false,
      error: p.error.issues[0]?.message ?? "Check coupon details.",
    };
  const c = p.data;
  try {
    const conn = await db().getConnection();
    let id = c.id;
    try {
      await conn.beginTransaction();
      const values = [
        c.code,
        c.kind,
        c.value,
        c.minSubtotal,
        c.maxDiscount,
        c.firstOrderOnly ? 1 : 0,
        c.usageLimit,
        c.perPhoneLimit,
        c.startsAt || null,
        c.endsAt || null,
        c.active ? 1 : 0,
      ];
      if (id) {
        const [existing] = await conn.execute<RowDataPacket[]>(
          "SELECT id FROM coupons WHERE id=? FOR UPDATE",
          [id],
        );
        if (!existing.length) throw new Error("Coupon not found.");
        await conn.execute(
          "UPDATE coupons SET code=?, kind=?, value=?, min_subtotal=?, max_discount=?, first_order_only=?, usage_limit=?, per_phone_limit=?, starts_at=?, ends_at=?, active=? WHERE id=?",
          [...values, id],
        );
      } else {
        const [result] = await conn.execute<ResultSetHeader>(
          "INSERT INTO coupons (code, kind, value, min_subtotal, max_discount, first_order_only, usage_limit, per_phone_limit, starts_at, ends_at, active) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          values,
        );
        id = Number(result.insertId);
      }
      await conn.execute("DELETE FROM coupon_targets WHERE coupon_id=?", [id]);
      for (const target of c.targets)
        await conn.execute(
          "INSERT INTO coupon_targets (coupon_id, kind, handle) VALUES (?,?,?)",
          [id, target.kind, target.handle],
        );
      await conn.execute(
        "INSERT INTO activity_log (admin_username, action, target, meta) VALUES (?, 'coupon.saved', ?, ?)",
        [
          admin.username,
          `coupon:${id}`,
          JSON.stringify({
            code: c.code,
            kind: c.kind,
            value: c.value,
            active: c.active,
          }),
        ],
      );
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
    revalidatePath("/admin/discounts");
    revalidatePath("/checkout");
    return { ok: true, id };
  } catch (error) {
    if ((error as { code?: string })?.code === "ER_DUP_ENTRY")
      return { ok: false, error: "A coupon with this code already exists." };
    console.error("saveCouponAction failed", error);
    return { ok: false, error: "Coupon could not be saved." };
  }
}

export async function validateCheckoutCouponAction(
  raw: unknown,
): Promise<
  | { ok: false; error: string }
  | { ok: true; code: string; discount: number; freeShipping: boolean }
> {
  const limit = await rateLimit("coupon", await clientIp(), 15, 10);
  if (!limit.ok)
    return {
      ok: false,
      error: `Too many attempts. Try again in ${limit.retryInMin} min.`,
    };
  const p = z
    .object({
      code: z.string().trim().min(1).max(30),
      phone: z.string().max(20),
    })
    .strict()
    .safeParse(raw);
  if (!p.success) return { ok: false, error: "Enter a coupon code." };
  const phone = p.data.phone
    .replace(/\D/g, "")
    .replace(/^(91|0)(?=\d{10}$)/, "");
  if (!/^[6-9]\d{9}$/.test(phone))
    return {
      ok: false,
      error: "Enter your mobile number first to check this code.",
    };
  const cart = await getCartAction();
  if (!cart?.lines.length) return { ok: false, error: "Your cart is empty." };
  const items = [];
  for (const line of cart.lines) {
    const product = await getProduct(line.product.handle);
    const variant = product?.variants.find(
      (v) => v.id === line.variant.id && v.availableForSale,
    );
    if (!product || !variant)
      return {
        ok: false,
        error: "A product in your cart is no longer available.",
      };
    items.push({
      productHandle: product.handle,
      unitPrice: variant.price.amount,
      quantity: line.quantity,
    });
  }
  const subtotal = items.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  try {
    const quote = await calculateCoupon(p.data.code, subtotal, phone, items);
    return { ok: true, ...quote };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "This code can't be applied.",
    };
  }
}

/** Cart drawer: check a code against the cart before checkout (no phone yet). Same server-side
 * pricing as checkout; first-order / per-phone limits are re-checked at checkout. */
export async function previewCartCouponAction(
  raw: unknown,
): Promise<
  | { ok: false; error: string }
  | { ok: true; code: string; discount: number; freeShipping: boolean; phoneRulesPending: boolean }
> {
  const limit = await rateLimit("coupon", await clientIp(), 15, 10);
  if (!limit.ok) return { ok: false, error: `Too many attempts. Try again in ${limit.retryInMin} min.` };
  const p = z.object({ code: z.string().trim().min(1).max(30) }).strict().safeParse(raw);
  if (!p.success) return { ok: false, error: "Enter a coupon code." };
  const cart = await getCartAction();
  if (!cart?.lines.length) return { ok: false, error: "Your cart is empty." };
  const items = [];
  for (const line of cart.lines) {
    const product = await getProduct(line.product.handle);
    const variant = product?.variants.find((v) => v.id === line.variant.id && v.availableForSale);
    if (!product || !variant) return { ok: false, error: "A product in your cart is no longer available." };
    items.push({ productHandle: product.handle, unitPrice: variant.price.amount, quantity: line.quantity });
  }
  const subtotal = items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  try {
    const quote = await calculateCoupon(p.data.code, subtotal, "", items);
    return { ok: true, code: quote.code, discount: quote.discount, freeShipping: quote.freeShipping, phoneRulesPending: !!quote.phoneRulesPending };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "This code can't be applied." };
  }
}
