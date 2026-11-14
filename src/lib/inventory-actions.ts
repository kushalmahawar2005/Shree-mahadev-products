"use server";

import { safe, type ActionResult } from "@/lib/action-result";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { TAGS } from "@/lib/commerce";
import { requireAdmin } from "@/lib/server/admin-auth";
import { adjustStock, inventoryLog } from "@/lib/server/inventory";
import { markRtoReceived } from "@/lib/server/orders";
import { setSetting } from "@/lib/server/videos";

const Adjust = z
  .object({
    variantKey: z.string().regex(/^[a-z0-9-]+--[a-z0-9.]+$/).max(100),
    mode: z.enum(["delta", "set", "untrack"]),
    value: z.number().int().min(-100_000).max(100_000),
    reason: z.enum(["restock_manual", "damaged", "correction"]),
    note: z.string().trim().max(200).optional(),
  })
  .strict()
  .refine((v) => v.mode !== "set" || v.value >= 0, "Stock can't be negative")
  .refine((v) => v.mode !== "delta" || v.value !== 0, "Enter a quantity");

function bust(variantKey: string) {
  updateTag(TAGS.products);
  updateTag(TAGS.product(variantKey.split("--")[0]));
}

export async function adjustStockAction(input: z.input<typeof Adjust>): Promise<ActionResult<number | null>> {
  return safe(async () => {
    await requireAdmin();
    const v = Adjust.parse(input);
    const after = await adjustStock(v.variantKey, v);
    bust(v.variantKey);
    return after;
  });
}

export async function inventoryLogAction(variantKey: string) {
  return safe(async () => {
    await requireAdmin();
    return inventoryLog(z.string().max(100).parse(variantKey));
  });
}

export async function setLowStockThresholdAction(value: number) {
  return safe(async () => {
    await requireAdmin();
    await setSetting("low_stock_threshold", z.number().int().min(0).max(1000).parse(value));
    updateTag("settings");
    revalidatePath("/admin/inventory");
  });
}

export async function markRtoReceivedAction(orderId: number) {
  return safe(async () => {
    await requireAdmin();
    const n = await markRtoReceived(z.number().int().positive().parse(orderId), "admin");
    updateTag(TAGS.products);
    revalidatePath("/admin/orders");
    return n;
  });
}
