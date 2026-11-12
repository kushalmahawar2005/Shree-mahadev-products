import { NextResponse, type NextRequest } from "next/server";
import { getCustomerSession } from "@/lib/server/customer-auth";
import {
  countAccountOrders,
  queryAccountOrders,
  ORDER_RANGES,
  ORDER_TABS,
  type OrderRange,
  type OrderTab,
} from "@/lib/server/account";

/** GET /api/account/orders?status&q&range&cursor — the signed-in shopper's orders, 10 per page. */
export async function GET(req: NextRequest) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const tab = (ORDER_TABS as readonly string[]).includes(sp.get("status") ?? "")
    ? (sp.get("status") as OrderTab)
    : "all";
  const range = (ORDER_RANGES as readonly string[]).includes(sp.get("range") ?? "")
    ? (sp.get("range") as OrderRange)
    : "all";
  const q = (sp.get("q") ?? "").slice(0, 60);
  const cursorRaw = Number(sp.get("cursor"));
  const cursor = Number.isInteger(cursorRaw) && cursorRaw > 0 ? cursorRaw : undefined;

  const [page, counts] = await Promise.all([
    queryAccountOrders(session.id, { tab, q, range }, cursor),
    // Counts only change with search/range, so skip them on "Load more".
    cursor ? null : countAccountOrders(session.id, { q, range }),
  ]);
  return NextResponse.json(
    { ...page, counts },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
