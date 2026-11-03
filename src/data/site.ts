export const site = {
  name: "Swadeshi Mahadev Products",
  shortName: "Swadeshi Mahadev",
  tagline: "Rajasthan ki asli kachi ghani",
  description:
    "Wood-pressed (kachi ghani) oils, raw honey and natural sweeteners, slowly pressed in a wooden ghani in Bijainagar, Rajasthan. No heat, no chemicals, no refining.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://swadeshimahadevproducts.com",
  phone: "+91-9251005103",
  phoneHref: "tel:+919251005103",
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "919251005103",
  supportHours: "9am–6pm",
  // TODO(client): replace with domain email (e.g. hello@swadeshimahadevproducts.com)
  email: "info.mahadevproducts@gmail.com",
  address: {
    line1: "12 B, New Bajrang Colony, Near Teja Chowk",
    city: "Bijainagar",
    district: "Beawar",
    state: "Rajasthan",
    postalCode: "305624",
    country: "IN",
  },
  // From the product label.
  fssai: "12226047000007",
  iso: "ISO 9001:2015",
  // TODO(client): GST number
  gst: "TODO(client)",
  // TODO(client): free shipping threshold final karna (old site showed both ₹999 and ₹500)
  freeShippingThreshold: 999,
  // TODO(client): flat shipping below the threshold, and COD charge. Placeholders until confirmed.
  shippingFee: 60,
  codFee: 0,
  codAvailable: true,
  // TODO(client): social media links
  socials: [] as { label: string; href: string }[],
} as const;

export const fullAddress = `${site.address.line1}, ${site.address.city} ${site.address.postalCode}, Dist. ${site.address.district}, ${site.address.state}`;

export function whatsappLink(message?: string) {
  const base = `https://wa.me/${site.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/**
 * Announcement bar. Desktop shows the first two side by side; mobile rotates all.
 * Copy from the live site. TODO(client): confirm the 10% first-order offer is still running.
 */
export const announcements = [
  "Get flat 10% off on your first order",
  "Order now and get it delivered to your doorstep",
  `Free shipping on orders above ₹${site.freeShippingThreshold}`,
];

export type MenuGroup = "oils" | "honey" | "sweeteners";

export type NavItem = {
  label: string;
  href: string;
  menu?: MenuGroup;
  icon?: "bestseller";
};

/** Header nav (content from the live site, layout from Two Brothers). */
export const mainNav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" },
  {
    label: "Wood Pressed Oils",
    href: "/collections/wood-pressed-oils",
    menu: "oils",
  },
  { label: "Raw Honey", href: "/collections/raw-honey", menu: "honey" },
  {
    label: "Natural Sweetener",
    href: "/collections/natural-sweeteners",
    menu: "sweeteners",
  },
  { label: "Contact Us", href: "/contact" },
  {
    label: "Best Seller",
    href: "/collections/bestsellers",
    icon: "bestseller",
  },
];

/** Secondary links (live site top bar). Shown in the mobile menu. */
export const utilityNav = [
  { label: "FAQ", href: "/faq" },
  { label: "My Account", href: "/track-order" },
  { label: "Order Tracking", href: "/track-order" },
  { label: "Our Ghani", href: "/our-ghani" },
  { label: "Lab Reports", href: "/lab-reports" },
  { label: "Bulk Orders", href: "/bulk-orders" },
  // TODO(client): brochure PDF for "Download Brochure"
];

export const footerNav = {
  shop: [
    { label: "All products", href: "/shop" },
    { label: "Wood-pressed oils", href: "/collections/wood-pressed-oils" },
    { label: "Raw honey", href: "/collections/raw-honey" },
    { label: "Natural sweeteners", href: "/collections/natural-sweeteners" },
    { label: "Bulk tins (5L / 15L)", href: "/collections/bulk-tins" },
    { label: "Combos", href: "/collections/combos" },
  ],
  learn: [
    { label: "Our ghani", href: "/our-ghani" },
    { label: "About us", href: "/about" },
    { label: "Lab reports", href: "/lab-reports" },
    { label: "Recipes", href: "/recipes" },
    { label: "Journal", href: "/journal" },
    { label: "FAQ", href: "/faq" },
  ],
  help: [
    { label: "Contact", href: "/contact" },
    { label: "Track order", href: "/track-order" },
    { label: "Bulk orders", href: "/bulk-orders" },
    { label: "Shipping policy", href: "/policies/shipping" },
    { label: "Refund & returns", href: "/policies/refund-return" },
    { label: "Privacy policy", href: "/policies/privacy" },
    { label: "Terms of service", href: "/policies/terms" },
  ],
};

export const shopByUse = [
  { label: "Daily cooking", tag: "daily-cooking", note: "Sabzi, dal, roti" },
  { label: "Deep frying", tag: "deep-frying", note: "Puri, pakode, namkeen" },
  { label: "Pickles & tadka", tag: "pickles-tadka", note: "Achaar, chhaunk" },
  { label: "Hair & skin", tag: "hair-skin", note: "Champi, body oil" },
  { label: "Baby massage", tag: "baby-massage", note: "Gentle malish" },
] as const;
