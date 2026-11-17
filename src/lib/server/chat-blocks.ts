import "server-only";

import type { ChatBlock } from "@/lib/chat/blocks";
import type { ChatProductCard, ChatSource } from "@/lib/server/chat-knowledge";

type Knowledge = { product?: ChatProductCard }[];
type CartAction = { action: "add"; product: ChatProductCard; variantId: string | null; qty: number } | { action: "cart" } | { action: "checkout" } | null;

const rupee = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const marker = (text: string, name: string) => text.match(new RegExp(`\\[\\[${name}:([^\\]]+)\\]\\]`))?.[1].split("|").map((item) => item.trim()).filter(Boolean) ?? [];

/** Product cards: up to 3 stacked cards, 4+ as one carousel. */
export function productBlocks(products: ChatProductCard[]): ChatBlock[] {
  const list = products.slice(0, 6);
  if (list.length >= 4) return [{ type: "product_carousel", products: list }];
  return list.map((product) => ({ type: "product_card", product }) as ChatBlock);
}

/** Rows only from real product data (no invented taste or smoke-point claims). */
export function comparisonBlock(products: ChatProductCard[]): ChatBlock | null {
  if (products.length < 2) return null;
  const list = products.slice(0, 3);
  const per100 = (product: ChatProductCard) => {
    const rates = product.variants.filter((variant) => variant.available && variant.size).map((variant) => ({ rate: variant.price / (variant.size! / 100), unit: variant.unit ?? "ml" }));
    if (!rates.length) return "–";
    const best = rates.reduce((low, item) => (item.rate < low.rate ? item : low));
    return `${rupee(Math.round(best.rate))} / 100 ${best.unit}`;
  };
  return {
    type: "comparison",
    products: list,
    rows: [
      { label: "Best for", values: list.map((product) => product.benefit ?? "–") },
      { label: "Sizes", values: list.map((product) => product.variants.map((variant) => variant.title).join(", ")) },
      { label: "Shuru", values: list.map((product) => rupee(product.price)) },
      { label: "Sabse sasta rate", values: list.map(per100) },
    ],
  };
}

/** Turns a finished model reply (markers) plus server context into typed blocks. */
export function blocksFromReply(input: {
  full: string;
  knowledge: Knowledge;
  action: CartAction;
  strongSources: ChatSource[];
}): ChatBlock[] {
  const { full, knowledge, action } = input;
  const find = (handle: string) => knowledge.find((entry) => entry.product?.handle === handle)?.product;
  const blocks: ChatBlock[] = [];

  const compared = marker(full, "compare").flatMap((handle) => find(handle) ?? []);
  const comparison = comparisonBlock(compared);
  if (comparison) blocks.push(comparison);

  if (action?.action === "add") blocks.push({ type: "size_picker", product: action.product, variantId: action.variantId, qty: action.qty });
  else if (action?.action === "cart") blocks.push({ type: "cart_summary" });
  else if (action?.action === "checkout") blocks.push({ type: "checkout_card" });
  else if (!comparison) {
    const said = full.toLowerCase();
    const marked = marker(full, "products").flatMap((handle) => find(handle) ?? []);
    const named = marked.length
      ? marked
      : knowledge.flatMap((entry) => entry.product && (said.includes(entry.product.title.toLowerCase().replace(/^wood-pressed\s+/, "")) || (entry.product.titleHi && full.includes(entry.product.titleHi))) ? [entry.product] : []);
    blocks.push(...productBlocks(named));
  }

  const source = input.strongSources.find((item) => item.href.startsWith("/policies") || item.href.startsWith("/lab-reports"));
  if (source && !blocks.some((block) => block.type.startsWith("product"))) {
    blocks.push({ type: "info_card", title: source.title, href: source.href, source: source.href.startsWith("/lab-reports") ? "Lab report" : "Store policy" });
  }

  if (full.includes("[[unknown]]")) blocks.push({ type: "handoff" });

  const options = marker(full, "options").slice(0, 5);
  if (options.length) blocks.push({ type: "quick_replies", options });
  return blocks;
}
