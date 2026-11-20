import { content } from "@/content";
import { site } from "@/data/site";
import { getCollections, getProducts } from "@/lib/commerce";
import { getStoreSettings } from "@/lib/server/store-settings";
import { absoluteUrl, plainText } from "@/lib/utils/seo";

/**
 * /llms.txt: a plain summary of the store for AI assistants and AI search (ChatGPT, Perplexity,
 * Gemini, Google AI Overviews): who we are, how the oils are made, every product with sizes and
 * prices, and the policy pages. Built from the live catalog, so prices are always current.
 */
export async function GET() {
  const [products, collections, settings] = await Promise.all([getProducts(), getCollections(), getStoreSettings()]);
  const rupee = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const lines: string[] = [
    `# ${site.name}`,
    "",
    `> ${site.description}`,
    "",
    `${site.name} is a family brand from ${site.address.city}, ${site.address.state}, India. Oils are pressed in a traditional wooden ghani (kolhu, "kachi ghani") at low speed, with no heat, no chemicals and no refining, then left to settle naturally and bottled. FSSAI licence ${site.fssai}. Sold online across India with UPI, cards, net banking${settings.shipping.codEnabled ? " and cash on delivery" : ""}.${settings.shipping.freeShippingThreshold ? ` Free shipping on orders of ${rupee(settings.shipping.freeShippingThreshold)} or more.` : ""}`,
    "",
    "## Products",
    "",
  ];
  for (const p of products) {
    const sizes = p.variants
      .filter((v) => v.availableForSale && v.price.amount > 0)
      .sort((a, b) => a.sizeValue - b.sizeValue)
      .map((v) => `${v.title} ${rupee(v.price.amount)}`);
    const about = plainText(p.shortDescription);
    lines.push(`- [${p.title}${p.titleHi ? ` (${p.titleHi})` : ""}](${absoluteUrl(`/products/${p.handle}`)}): ${about}${sizes.length ? ` Sizes: ${sizes.join(", ")}.` : " Currently unavailable."}`);
  }
  lines.push("", "## Collections", "");
  for (const c of collections) lines.push(`- [${c.title}](${absoluteUrl(`/collections/${c.handle}`)})${c.description ? `: ${plainText(c.description)}` : ""}`);
  lines.push(
    "",
    "## About and help",
    "",
    `- [Our ghani (how the oil is made)](${absoluteUrl("/our-ghani")})`,
    `- [About us](${absoluteUrl("/about")})`,
    `- [Lab reports](${absoluteUrl("/lab-reports")})`,
    `- [Bulk orders](${absoluteUrl("/bulk-orders")})`,
    `- [FAQ](${absoluteUrl("/faq")})`,
    `- [Contact](${absoluteUrl("/contact")}): ${site.phone}, WhatsApp +${site.whatsapp}, ${site.email}`,
    ...content.policies.map((e) => `- [${e.title}](${absoluteUrl(`/policies/${e.slug}`)})`),
  );
  if (content.recipes.length || content.journal.length) {
    lines.push("", "## Recipes and articles", "");
    for (const e of [...content.journal, ...content.recipes]) lines.push(`- [${e.title}](${absoluteUrl(`/${content.recipes.includes(e) ? "recipes" : "journal"}/${e.slug}`)})`);
  }
  return new Response(`${lines.join("\n")}\n`, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
