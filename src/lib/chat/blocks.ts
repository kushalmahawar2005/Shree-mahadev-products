import { z } from "zod";

/**
 * Typed reply blocks for the chat assistant. The server (model markers + local intent
 * handlers) emits these; the widget validates each one and renders it with its own
 * component. Anything that fails validation is dropped (text stays as text bubbles).
 */

export const ChatVariantSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: z.number(),
  compareAt: z.number().optional(),
  available: z.boolean(),
  size: z.number().optional(),
  unit: z.enum(["ml", "g"]).optional(),
});

export const ChatProductSchema = z.object({
  handle: z.string(),
  title: z.string(),
  titleHi: z.string().optional(),
  category: z.string().optional(),
  href: z.string(),
  image: z.string().nullable(),
  price: z.number(),
  inStock: z.boolean(),
  variants: z.array(ChatVariantSchema),
  defaultSize: z.string().optional(),
  benefit: z.string().optional(),
  popular: z.array(z.string()).optional(),
  trust: z.string().optional(),
});

const OrderEventSchema = z.object({ status: z.string(), label: z.string(), at: z.string(), location: z.string().nullable() });
export const OrderStatusSchema = z.object({
  id: z.number(),
  orderNo: z.string(),
  status: z.string(),
  createdAt: z.string(),
  method: z.string().optional(),
  eta: z.string().nullable().optional(),
  courier: z.string().nullable().optional(),
  awb: z.string().nullable().optional(),
  trackingUrl: z.string().nullable().optional(),
  events: z.array(OrderEventSchema).default([]),
  refunds: z.array(z.object({ amount: z.number(), status: z.string(), at: z.string() })).default([]),
});
export const OrderRowSchema = z.object({ id: z.number(), orderNo: z.string(), status: z.string(), createdAt: z.string(), eta: z.string().nullable().optional() });

export const BlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().max(1200) }),
  z.object({ type: z.literal("quick_replies"), options: z.array(z.string().max(60)).min(1).max(5) }),
  z.object({ type: z.literal("option_picker"), question: z.string().max(200), options: z.array(z.string().max(60)).min(2).max(6) }),
  z.object({ type: z.literal("product_card"), product: ChatProductSchema }),
  z.object({ type: z.literal("product_carousel"), products: z.array(ChatProductSchema).min(2).max(6) }),
  z.object({
    type: z.literal("comparison"),
    products: z.array(ChatProductSchema).min(2).max(3),
    rows: z.array(z.object({ label: z.string(), values: z.array(z.string()) })),
  }),
  z.object({ type: z.literal("size_picker"), product: ChatProductSchema, variantId: z.string().nullable(), qty: z.number().int().min(1).max(10), done: z.boolean().optional() }),
  z.object({ type: z.literal("cart_summary"), title: z.string().optional() }),
  z.object({ type: z.literal("checkout_card") }),
  z.object({ type: z.literal("order_status"), order: OrderStatusSchema, intent: z.enum(["track", "cancel", "refund", "return"]).default("track") }),
  z.object({ type: z.literal("order_list"), orders: z.array(OrderRowSchema).min(1), intent: z.enum(["track", "cancel", "refund", "return"]).default("track") }),
  z.object({
    type: z.literal("action_confirm"),
    kind: z.enum(["cancel", "cancel_request", "return"]),
    orderId: z.number(),
    orderNo: z.string(),
    summary: z.string(),
    consequences: z.array(z.string()).max(4),
    resolved: z.enum(["confirmed", "dismissed"]).optional(),
  }),
  z.object({ type: z.literal("info_card"), title: z.string(), body: z.string().optional(), href: z.string().optional(), source: z.string() }),
  z.object({ type: z.literal("login_card"), intent: z.enum(["track", "cancel", "refund", "return"]).default("track") }),
  z.object({ type: z.literal("handoff"), reason: z.string().optional() }),
  z.object({ type: z.literal("notice"), tone: z.enum(["success", "warning", "error"]), text: z.string().max(300) }),
]);

export type ChatBlock = z.infer<typeof BlockSchema>;
export type ChatBlockOf<T extends ChatBlock["type"]> = Extract<ChatBlock, { type: T }>;

/** Keeps only blocks that pass the schema (bad model output never reaches the UI). */
export function parseBlocks(raw: unknown): ChatBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const parsed = BlockSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}
