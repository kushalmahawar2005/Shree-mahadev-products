import { accountConfig } from "@/config/account";
import { supportConfig } from "@/config/support";
import { site } from "@/data/site";
import type { StoreSettings } from "@/lib/store-settings";
import { formatMoney } from "@/lib/utils/money";

/*
 * Single source for FAQ answers (account help centre + public /faq).
 * Answers are "markdown-lite": **bold** and [label](/link) only.
 * Shipping/COD values come from live store settings; refund timelines from config.
 */

export const FAQ_CATEGORIES = [
  { id: "orders", label: "Orders & delivery" },
  { id: "payments", label: "Payments & refunds" },
  { id: "returns", label: "Returns" },
  { id: "products", label: "Products & storage" },
  { id: "account", label: "Account" },
] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number]["id"];

export type FaqEntry = {
  id: string;
  category: FaqCategory;
  question: string;
  /** Markdown-lite: **bold** and [label](href). */
  answer: string;
  keywords: string[];
  /** Only meaningful inside the signed-in account (hidden on the public page). */
  accountOnly?: boolean;
};

type Shipping = StoreSettings["shipping"];

export function buildFaqs(shipping: Shipping): FaqEntry[] {
  const days = accountConfig.returnWindowDays;
  return [
    /* Orders & delivery */
    {
      id: "shipping-cost",
      category: "orders",
      question: "How much is shipping?",
      answer: `Shipping is **free on orders above ${formatMoney(shipping.freeShippingThreshold)}**. Below that, the charge depends on your pincode and is shown at checkout along with the estimated delivery date.`,
      keywords: ["delivery charge", "shipping fee", "free shipping", "cost"],
    },
    {
      id: "track-order",
      category: "orders",
      question: "How do I track my order?",
      answer:
        "Open the order in [My orders](/account/orders) to see live tracking, or use your order number and phone on the [track order](/track-order) page. We also send the tracking link on WhatsApp once it ships.",
      keywords: ["tracking", "where is my order", "awb", "courier", "status"],
    },
    {
      id: "delivery-time",
      category: "orders",
      question: "How long does delivery take?",
      answer:
        "Orders are packed fresh and usually ship within 1–2 days. The courier's estimated delivery date is shown at checkout and on your order page. Remote areas can take longer.",
      keywords: ["eta", "how many days", "delay", "late", "dispatch"],
    },
    {
      id: "cancel-order",
      category: "orders",
      question: "Can I cancel my order?",
      answer:
        "Yes, **before it ships**. Open the order in [My orders](/account/orders) and tap Cancel, or pick it in [Help & support](/account/help). Paid online orders are cancelled by our team and refunded in full.",
      keywords: ["cancel", "cancellation", "change mind"],
    },
    {
      id: "change-address",
      category: "orders",
      question: "Can I change the delivery address?",
      answer:
        "Yes, until the order is packed. Pick the order in Get help with an order, choose **Change address** and send us the new address. Once it is packed we can't change it.",
      keywords: ["address", "wrong address", "change pincode"],
      accountOnly: true,
    },
    {
      id: "ship-abroad",
      category: "orders",
      question: "Do you ship outside India?",
      answer: "No, we currently ship within India only.",
      keywords: ["international", "abroad", "outside india"],
    },
    {
      id: "bulk",
      category: "orders",
      question: "Can I order in bulk for my shop or restaurant?",
      answer: "Yes. We supply 5 L and 15 L tins and can set up regular supply. [Send a bulk inquiry](/bulk-orders).",
      keywords: ["bulk", "wholesale", "tin", "restaurant", "shop"],
    },

    /* Payments & refunds */
    {
      id: "cod",
      category: "payments",
      question: "Do you offer cash on delivery?",
      answer: shipping.codEnabled
        ? `Yes, **COD is available**${shipping.codMaxOrder ? ` on orders up to ${formatMoney(shipping.codMaxOrder)}` : ""} for serviceable pincodes. Any COD charge is shown at checkout before you place the order.`
        : "Not at the moment. You can pay online with UPI, cards, net banking or wallets.",
      keywords: ["cod", "cash on delivery", "pay on delivery"],
    },
    {
      id: "payment-methods",
      category: "payments",
      question: "Which payment methods do you accept?",
      answer: "UPI, debit and credit cards, net banking and wallets, processed securely by PayU.",
      keywords: ["upi", "card", "net banking", "payu", "wallet"],
    },
    {
      id: "money-deducted",
      category: "payments",
      question: "Money was deducted but the order shows unpaid.",
      answer: `**Please don't pay again.** Payments can take a few minutes to confirm. If the payment failed, your bank reverses it automatically in ${supportConfig.autoRefundDays}. Still stuck? Pick the order in [Help & support](/account/help) and share the UPI/UTR reference.`,
      keywords: ["deducted", "debited", "payment failed", "unpaid", "utr", "upi"],
    },
    {
      id: "refund-time",
      category: "payments",
      question: "How long does a refund take?",
      answer: `Prepaid orders are refunded to the original payment method. Banks usually take **${supportConfig.autoRefundDays}** after we process it. COD refunds go by bank transfer or UPI. [Refund & returns policy](/policies/refund-return).`,
      keywords: ["refund", "money back", "refund status", "how long"],
    },

    /* Returns */
    {
      id: "damaged",
      category: "returns",
      question: "My item arrived damaged, leaking or wrong. What now?",
      answer: `Report it within **${days} days of delivery**. Pick the order in [Help & support](/account/help), choose the issue and add photos of the bottle/box and the label. We replace or refund it as per our [refund & returns policy](/policies/refund-return).`,
      keywords: ["damaged", "leak", "leaking", "broken", "wrong item", "missing", "replacement"],
    },
    {
      id: "return-opened",
      category: "returns",
      question: "Can I return an opened product?",
      answer:
        "Food items can't be taken back once opened or used, for hygiene reasons, unless it is a quality problem we confirm. See the [refund & returns policy](/policies/refund-return).",
      keywords: ["return", "opened", "used", "exchange"],
    },
    {
      id: "return-how",
      category: "returns",
      question: "How do I request a return?",
      answer: `For eligible items, open the delivered order in [My orders](/account/orders) and use **Request a return** within ${days} days of delivery. Our team reviews it and replies on WhatsApp.`,
      keywords: ["return request", "return window", "how to return"],
      accountOnly: true,
    },

    /* Products & storage */
    {
      id: "kachi-ghani",
      category: "products",
      question: "What is kachi ghani (wood-pressed) oil?",
      answer: "Oil pressed slowly in a ghani, without external heat or chemicals, and not refined afterwards. [See how we press](/our-ghani).",
      keywords: ["wood pressed", "cold pressed", "kachi ghani", "process"],
    },
    {
      id: "smell",
      category: "products",
      question: "Why does the oil smell stronger than supermarket oil?",
      answer: "Because it is not deodorised. The smell and taste are those of the seed itself.",
      keywords: ["smell", "pungent", "taste", "strong"],
    },
    {
      id: "sediment",
      category: "products",
      question: "There is sediment at the bottom of my bottle. Is that OK?",
      answer: "Yes. Unrefined oil can carry fine seed particles. It is natural and safe.",
      keywords: ["sediment", "cloudy", "particles", "settled"],
    },
    {
      id: "honey-crystal",
      category: "products",
      question: "My honey has crystallised. Is it still good?",
      answer: "Yes. Raw honey can set in cold weather. Stand the jar in warm (not hot) water to make it runny again.",
      keywords: ["honey", "crystallised", "solid", "thick"],
    },
    {
      id: "storage",
      category: "products",
      question: "How should I store the oil?",
      answer: "Keep it tightly closed in a cool, dark place, away from the stove and direct sunlight. Use a dry spoon or pour directly.",
      keywords: ["store", "storage", "shelf life", "keep"],
    },
    {
      id: "lab-tested",
      category: "products",
      question: "Are your products lab tested?",
      answer: "Yes. Read the test reports and our FSSAI licence on the [lab reports](/lab-reports) page.",
      keywords: ["lab", "test", "fssai", "purity", "quality"],
    },

    /* Account */
    {
      id: "update-details",
      category: "account",
      question: "How do I change my name, email or saved addresses?",
      answer: "Update them from [Profile](/account/profile) and [Addresses](/account/addresses) in your account.",
      keywords: ["profile", "email", "name", "address book"],
      accountOnly: true,
    },
    {
      id: "contact",
      category: "account",
      question: "How can I reach you?",
      answer: `WhatsApp or call **${site.phone}** (${supportConfig.hours.label}), or email ${site.email}. [All contact options](/contact).`,
      keywords: ["contact", "phone", "whatsapp", "email", "support"],
    },
  ];
}

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Markdown-lite → plain text (JSON-LD, search, WhatsApp). */
export const faqPlain = (md: string) => md.replace(LINK, "$1").replace(/\*\*([^*]+)\*\*/g, "$1");

/** First [label](href) in an answer, if any. */
export function faqFirstLink(md: string): { href: string; label: string } | undefined {
  const m = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(md);
  return m ? { label: m[1]!, href: m[2]! } : undefined;
}

/** schema.org FAQPage for a list of entries. */
export const faqJsonLd = (faqs: FaqEntry[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: faqPlain(f.answer) },
  })),
});
