import { requireAdmin } from "@/lib/server/admin-auth";
import { ordersCsv } from "@/lib/server/bulk-orders";
import type { OrderFilter } from "@/lib/server/orders";

const FILTERS: OrderFilter[] = ["needs_action", "all", "to_ship", "awaiting_payment", "shipped", "delivered", "cancelled"];
const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

/** GET ?f=&q=&from=&to= → the same orders as the list view (all pages) as a CSV that opens in Excel. */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const sp = new URL(request.url).searchParams;
  const f = sp.get("f") as OrderFilter;
  const from = day(sp.get("from"));
  const to = day(sp.get("to")) ?? from;
  const csv = await ordersCsv({ filter: FILTERS.includes(f) ? f : "all", q: (sp.get("q") ?? "").slice(0, 60), from, to });
  const name = `orders${from ? `-${from}${to && to !== from ? `-to-${to}` : ""}` : ""}.csv`;
  // BOM so Excel reads ₹ and Hindi names correctly.
  return new Response(`﻿${csv}`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" },
  });
}
