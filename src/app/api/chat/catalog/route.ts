import { NextResponse } from "next/server";
import { loadChatCatalog, orderStats, toChatProduct } from "@/lib/server/chat-knowledge";

/** Products for the chat widget's Shop tab and context cards (public catalog data only). */
export async function GET() {
  const [catalog, stats] = await Promise.all([loadChatCatalog(), orderStats()]);
  const products = catalog.map((product) => toChatProduct(product, { variantOrders: stats.variants, productOrders: stats.products.get(product.handle) ?? 0 }));
  return NextResponse.json({ products }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
