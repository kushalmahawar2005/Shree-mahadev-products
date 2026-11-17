import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildFaqs } from "@/content/faqs";
import { content } from "@/content/registry";
import { site } from "@/data/site";
import { products as fallbackProducts } from "@/data/products";
import { proof } from "@/data/home";
import { loadProducts } from "@/lib/server/catalog";
import { getStoreSettings } from "@/lib/server/store-settings";
import { listChatAnswers } from "@/lib/server/chat-logs";
import { PLACED_STATUSES } from "@/lib/server/account";
import { db } from "@/lib/server/db";
import type { RowDataPacket } from "mysql2/promise";

/** Real social proof only: below these numbers the line is left out rather than looking thin. */
const MIN_ORDERS_TO_SHOW = 25;
const MIN_REVIEWS_TO_SHOW = 3;
const LOW_STOCK = 10;

type OrderStats = { products: Map<string, number>; variants: Map<string, number> };

/** Orders per product and per variant (placed orders only), for trust lines and "most bought" sizes. */
export async function orderStats(): Promise<OrderStats> {
  const stats: OrderStats = { products: new Map(), variants: new Map() };
  if (!process.env.DATABASE_NAME) return stats;
  try {
    const [rows] = await db().query<RowDataPacket[]>(
      `SELECT oi.product_handle AS handle, oi.variant_key AS variant, COUNT(DISTINCT oi.order_id) AS orders
       FROM order_items oi JOIN orders o ON o.id = oi.order_id
       WHERE o.status IN (?) GROUP BY oi.product_handle, oi.variant_key`,
      [PLACED_STATUSES],
    );
    for (const row of rows) {
      stats.variants.set(String(row.variant), Number(row.orders));
      stats.products.set(String(row.handle), (stats.products.get(String(row.handle)) ?? 0) + Number(row.orders));
    }
  } catch (error) {
    console.error("chat order stats", error);
  }
  return stats;
}

/** Honest selling points from live data: orders, reviews and genuinely low stock. */
function proofLine(product: Product, orders: number) {
  const parts: string[] = [];
  if (orders >= MIN_ORDERS_TO_SHOW) parts.push(`Ordered by ${orders}+ customers so far`);
  if (product.rating && (product.reviewCount ?? 0) >= MIN_REVIEWS_TO_SHOW) parts.push(`Rated ${product.rating.toFixed(1)}/5 by ${product.reviewCount} customers`);
  const low = product.variants.filter((variant) => variant.availableForSale && typeof variant.stock === "number" && variant.stock > 0 && variant.stock <= LOW_STOCK);
  if (low.length) parts.push(`Low stock: ${low.map((variant) => `only ${variant.stock} left in ${variant.title}`).join(", ")}`);
  return parts.length ? `Social proof (real data, use these exact numbers only): ${parts.join("; ")}.` : "";
}
import type { Product } from "@/lib/commerce/types";

export type ChatVariant = { id: string; title: string; price: number; compareAt?: number; available: boolean; size?: number; unit?: "ml" | "g" };
export type ChatProductCard = {
  handle: string; title: string; titleHi?: string; category: string; href: string; image: string | null;
  price: number; inStock: boolean; variants: ChatVariant[]; defaultSize?: string;
  /** One line from product data ("Daily cooking · Deep frying"), never written by the AI. */
  benefit?: string;
  /** Variant ids, most ordered first (falls back to the default size). */
  popular?: string[];
  /** Real social proof line, only when the numbers clear the thresholds. */
  trust?: string;
};
type ChatProductExtras = { variantOrders?: Map<string, number>; productOrders?: number };

/** The card shape the chat widget renders (Shop tab, product carousels, add-to-cart). */
export function toChatProduct(product: Product, extras: ChatProductExtras = {}): ChatProductCard {
  const orders = extras.variantOrders;
  const popular = [...product.variants]
    .sort((a, b) => (orders?.get(b.id) ?? 0) - (orders?.get(a.id) ?? 0) || Number(b.title === product.defaultSize) - Number(a.title === product.defaultSize))
    .map((variant) => variant.id);
  const trustParts = [
    (extras.productOrders ?? 0) >= MIN_ORDERS_TO_SHOW ? `${extras.productOrders}+ orders` : "",
    product.rating && (product.reviewCount ?? 0) >= MIN_REVIEWS_TO_SHOW ? `★ ${product.rating.toFixed(1)} (${product.reviewCount} reviews)` : "",
  ].filter(Boolean);
  return {
    benefit: product.bestFor.slice(0, 2).join(" · ") || product.shortDescription || undefined,
    popular,
    trust: trustParts.join(" · ") || undefined,
    handle: product.handle,
    title: product.title,
    titleHi: product.titleHi || undefined,
    category: product.category,
    href: `/products/${product.handle}`,
    image: product.images[0]?.url ?? null,
    price: Number(product.priceRange.min.amount),
    inStock: product.variants.some((variant) => variant.availableForSale),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      title: variant.title,
      price: Number(variant.price.amount),
      size: variant.sizeValue,
      unit: variant.sizeUnit,
      ...(variant.compareAtPrice && Number(variant.compareAtPrice.amount) > Number(variant.price.amount) ? { compareAt: Number(variant.compareAtPrice.amount) } : {}),
      available: variant.availableForSale && !variant.outOfStock,
    })),
    defaultSize: product.defaultSize,
  };
}

export async function loadChatCatalog(): Promise<Product[]> {
  if (!process.env.DATABASE_NAME) return fallbackProducts;
  try {
    const live = await loadProducts({ status: "active" });
    return live.length ? live : fallbackProducts;
  } catch (error) {
    console.error("chat catalog", error);
    return fallbackProducts;
  }
}
export type ChatSource = { title: string; href: string; excerpt: string; score?: number; product?: ChatProductCard };
type KnowledgeEntry = ChatSource & { terms: string[] };

const aliases: Record<string, string[]> = {
  fayda: ["benefits"], fayde: ["benefits"], faide: ["benefits"], faayde: ["benefits"], labh: ["benefits"], fayadey: ["benefits"], benefit: ["benefits"],
  फायदा: ["benefits"], फायदे: ["benefits"], लाभ: ["benefits"], nariyal: ["coconut"], badam: ["almond"], kalonji: ["black", "seed"],
  tel: ["oil"], tail: ["oil"], telka: ["oil"], moongfali: ["groundnut"], mungfali: ["groundnut"],
  तेल: ["oil"], मूंगफली: ["groundnut"],
  sarso: ["mustard"], sarson: ["mustard"], rai: ["mustard"], til: ["sesame"], alsi: ["flaxseed"],
  सरसों: ["mustard"], तिल: ["sesame"], अलसी: ["flaxseed"],
  shahad: ["honey"], madhu: ["honey"], gud: ["jaggery"], khand: ["sweetener"],
  शहद: ["honey"], मधु: ["honey"], गुड़: ["jaggery"], खांड: ["sweetener"],
  order: ["order"], parcel: ["delivery", "tracking"], kaha: ["where", "tracking"], kahan: ["where", "tracking"],
  kab: ["when", "delivery"], pahuchega: ["delivery", "eta"], pahuncha: ["delivery", "tracking"],
  radd: ["cancel"], cancel: ["cancel"], wapas: ["return", "refund"], paise: ["money", "refund"],
  kata: ["deducted", "payment"], payment: ["payment"], bhugtan: ["payment"], kitna: ["price", "cost"],
  kharab: ["damaged", "quality"], toota: ["damaged"], leak: ["leaking"], ris: ["leaking"],
  rate: ["price", "cost"], daam: ["price", "cost"], keemat: ["price", "cost"], kimat: ["price", "cost"], कीमत: ["price", "cost"], दाम: ["price", "cost"], रेट: ["price", "cost"],
  ऑर्डर: ["order"], पार्सल: ["delivery", "tracking"], कहाँ: ["where", "tracking"], कहां: ["where", "tracking"],
  मेरा: ["my"], मेरी: ["my"], रद्द: ["cancel"], निरस्त: ["cancel"], रिफंड: ["refund"], वापसी: ["return", "refund"],
  पैसे: ["money", "refund"], कटा: ["deducted", "payment"], कटे: ["deducted", "payment"], डिलीवरी: ["delivery"], ट्रैक: ["track", "tracking"],
};

export function normalizeChatText(value: string) {
  const normalized = value.normalize("NFKC").toLocaleLowerCase("en-IN").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\bground nut\b/g, "groundnut").replace(/\bmung ?fali\b/g, "groundnut").trim();
  const expanded = normalized.split(/\s+/).flatMap((word) => [word, ...(aliases[word] ?? [])]);
  return [...new Set(expanded)];
}

function plain(value: string) {
  return value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/TODO\s*\(client\):[^.]*\.?/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 $2")
    .replace(/[#*_`>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readContentFile(kind: string, slug: string) {
  try {
    return await readFile(path.join(process.cwd(), "src", "content", kind, `${slug}.mdx`), "utf8");
  } catch {
    return "";
  }
}

function productEntries(items: Product[], stats: OrderStats = { products: new Map(), variants: new Map() }): KnowledgeEntry[] {
  const orders = stats.products;
  return items.map((product) => {
    const variantText = product.variants
      .map((variant) => `${variant.title}: ${variant.availableForSale ? `₹${variant.price.amount}` : "currently unavailable"}`)
      .join("; ");
    // Prices first: grounding excerpts are truncated, and size/price is the most asked fact.
    const excerpt = [
      `Sizes and prices: ${variantText}`,
      proofLine(product, orders.get(product.handle) ?? 0),
      product.bestFor.length ? `Best for: ${product.bestFor.join(", ")}` : "",
      product.shortDescription,
      plain(product.descriptionHtml),
      product.titleHi,
      product.benefits.join("; "),
      product.bestFor.join("; "),
      product.howToUse,
      product.processNote,
      product.ingredients,
      product.shelfLife,
      ...(product.faqs ?? []).flatMap((faq) => [faq.q, faq.a]),
    ].filter(Boolean).join(". ");
    return {
      title: product.title,
      href: `/products/${product.handle}`,
      excerpt,
      product: toChatProduct(product, { variantOrders: stats.variants, productOrders: orders.get(product.handle) ?? 0 }),
      terms: [product.title, product.titleHi, product.handle, product.category, "price", "cost", "size", "benefits", "uses", ...product.tags, ...product.bestFor, ...(product.faqs ?? []).flatMap((faq) => [faq.q, faq.a])],
    };
  });
}

export async function getChatKnowledge(): Promise<KnowledgeEntry[]> {
  const settings = await getStoreSettings();
  const faqEntries = buildFaqs(settings.shipping).map((faq) => ({
    title: faq.question,
    href: faq.answer.match(/\]\((\/[^)]+)\)/)?.[1] ?? "/faq",
    excerpt: plain(faq.answer),
    terms: [faq.question, ...faq.keywords, faq.category],
  }));

  let catalog: Product[] = fallbackProducts;
  if (process.env.DATABASE_NAME) {
    try {
      const live = await loadProducts({ status: "active" });
      if (live.length) catalog = live;
    } catch (error) {
      console.error("chat knowledge catalog", error);
    }
  }

  const contentEntries: KnowledgeEntry[] = [];
  for (const [kind, entries] of Object.entries(content)) {
    for (const entry of entries) {
      const source = await readContentFile(kind, entry.slug);
      const href = kind === "policies" ? `/policies/${entry.slug}` : `/${kind === "journal" ? "journal" : "recipes"}/${entry.slug}`;
      const excerpt = plain(`${entry.title}. ${entry.description}. ${source}`);
      if (excerpt) contentEntries.push({ title: entry.title, href, excerpt, terms: [entry.title, entry.description, entry.slug, kind] });
    }
  }

  const siteEntry: KnowledgeEntry = {
    title: "About Swadeshi Mahadev Products",
    href: "/contact",
    excerpt: `${site.name}. ${site.description}. Phone and WhatsApp ${site.phone}. Email ${site.email}. Support hours ${site.supportHours}. Address ${site.address.line1}, ${site.address.city}, ${site.address.district}, ${site.address.state} ${site.address.postalCode}. FSSAI ${site.fssai}.`,
    terms: ["contact", "phone", "whatsapp", "email", "address", "fssai", "support", "about", site.name],
  };

  const pageEntries: KnowledgeEntry[] = [
    {
      title: "Product range",
      href: "/shop",
      excerpt: `We sell wood-pressed cooking and wellness oils, raw honey and natural sweeteners. Current products include ${catalog.map((product) => product.title).join(", ")}. Open the shop to see current sizes, prices and availability.`,
      terms: ["products", "product range", "what do you sell", "shop", "oils", "honey", "sweetener", "jaggery", "khand", "wood pressed", "raw"],
    },
    {
      title: "About us",
      href: "/about",
      excerpt: "Swadeshi Mahadev Products is a small kachi ghani unit in Bijainagar, in the Beawar district of Rajasthan. We press oil in a wooden ghani and bottle raw honey and natural sweeteners. A wooden ghani gives less oil and takes longer, so the oil keeps the taste and smell of the seed.",
      terms: ["family", "about", "Bijainagar", "Rajasthan", "wooden ghani", "unit", "visit"],
    },
    {
      title: "Our ghani and oil process",
      href: "/our-ghani",
      excerpt: "A wooden ghani turns at a walking pace. It takes longer and gives less oil than a machine, but the oil stays cool and keeps the taste of the seed. See the four slow steps and what we never do.",
      terms: ["wood press", "kachi ghani", "how made", "process", "refined", "heat", "chemicals", "slow"],
    },
    {
      title: "Bulk orders",
      href: "/bulk-orders",
      excerpt: "Bulk wood-pressed oil is available for restaurants, caterers, sweet shops and retailers. 5 L and 15 L tins, with regular supply on request. Current retail tin prices are listed on the page; ask the team about trade pricing and regular supply.",
      terms: ["bulk", "wholesale", "trade", "restaurant", "caterer", "retailer", "5l", "15l", "tin", "business"],
    },
    {
      title: "Account help and order requests",
      href: "/account/help",
      excerpt: "Sign in and open Help & support to request a delivery address or date change, report a delayed parcel, ask about an unpaid payment, request a callback, or send a damaged, leaking, wrong or missing item report. Order ownership, order status and policy checks are verified by the support flow.",
      terms: ["change address", "wrong address", "change pincode", "change delivery date", "delivery date", "delayed", "late", "missing item", "wrong item", "damaged", "leaking", "quality", "payment failed", "money deducted", "callback", "support request", "help", "my request"],
    },
    {
      title: "Lab reports",
      href: "/lab-reports",
      excerpt: `Lab test reports and FSSAI information are available on the lab reports page. ${proof.reports.map((report) => `${report.name} ${report.reportNo}`).join(". ")} Ask the team on WhatsApp for a report that is not listed.`,
      terms: ["lab", "test", "report", "purity", "FSSAI", proof.fssaiNo, ...proof.reports.map((report) => report.name)],
    },
  ];

  let ownerAnswers: KnowledgeEntry[] = [];
  if (process.env.DATABASE_NAME) {
    try {
      // Owner-written answers from Admin → Chat assistant; title/terms weigh heavily so they win ties.
      ownerAnswers = (await listChatAnswers(true)).map((item) => ({
        title: item.question,
        href: "/faq",
        excerpt: item.answer,
        terms: [item.question, item.keywords, item.question],
      }));
    } catch (error) {
      console.error("chat owner answers", error);
    }
  }

  return [...ownerAnswers, ...faqEntries, ...productEntries(catalog, await orderStats()), ...contentEntries, ...pageEntries, siteEntry];
}

export function searchChatKnowledge(query: string, entries: KnowledgeEntry[], limit = 3, excerptLength = 520) {
  const queryWords = normalizeChatText(query).filter((word) => word.length > 1);
  if (!queryWords.length) return [] as ChatSource[];
  const scored = entries.map((entry) => {
    const searchable = normalizeChatText(`${entry.title} ${entry.terms.join(" ")} ${entry.excerpt}`);
    const titleWords = new Set(normalizeChatText(entry.title));
    const searchableWords = new Set(searchable);
    let score = 0;
    for (const word of queryWords) {
      if (titleWords.has(word)) score += 3;
      else if (searchableWords.has(word)) score += 1;
    }
    const q = queryWords.join(" ");
    if (q.length > 4 && normalizeChatText(`${entry.title} ${entry.terms.join(" ")}`).join(" ").includes(q)) score += 3;
    return { entry, score };
  }).filter((item) => item.score >= 2).sort((a, b) => b.score - a.score).slice(0, limit);
  return scored.map(({ entry, score }): ChatSource => ({ title: entry.title, href: entry.href, excerpt: entry.excerpt.slice(0, excerptLength), score, product: entry.product }));
}
