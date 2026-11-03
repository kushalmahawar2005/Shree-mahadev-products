export type ContentKind = "recipes" | "journal" | "policies";

export type ContentEntry = {
  slug: string;
  title: string;
  description: string;
  date?: string;
  color?: string;
  /** product handles used in this recipe / post */
  products?: string[];
};

/** Registry of local MDX content. Add a file in src/content/<kind>/<slug>.mdx and list it here. */
export const content: Record<ContentKind, ContentEntry[]> = {
  recipes: [
    {
      slug: "dal-tadka-mustard-oil",
      title: "Dal tadka in kachi ghani mustard oil",
      description: "Everyday arhar dal with a smoking-hot sarson tadka.",
      date: "2026-10-20",
      color: "#E0A526",
      products: ["yellow-mustard-oil"],
    },
    {
      slug: "aloo-puri-groundnut-oil",
      title: "Crisp puri fried in groundnut oil",
      description: "Why groundnut oil is the old favourite for deep frying.",
      date: "2026-10-12",
      color: "#D9B45A",
      products: ["groundnut-oil"],
    },
  ],
  journal: [
    {
      slug: "what-is-kachi-ghani",
      title: "What kachi ghani actually means",
      description: "Wood-pressed, cold-pressed, refined: the difference in plain words.",
      date: "2026-10-25",
      color: "#D0B17A",
    },
    {
      slug: "why-our-oil-looks-cloudy",
      title: "Why our oil sometimes looks cloudy",
      description: "Sediment, winter thickening and other signs of real, unrefined oil.",
      date: "2026-10-05",
      color: "#F6EFE2",
    },
  ],
  policies: [
    { slug: "privacy", title: "Privacy policy", description: "How we handle your personal information." },
    { slug: "refund-return", title: "Refund & return policy", description: "Returns, replacements and refunds." },
    { slug: "shipping", title: "Shipping policy", description: "Where we ship, how long it takes, and charges." },
    { slug: "terms", title: "Terms of service", description: "Terms for using this website and buying from us." },
  ],
};

export function getEntry(kind: ContentKind, slug: string) {
  return content[kind].find((e) => e.slug === slug);
}

export async function loadMdx(kind: ContentKind, slug: string) {
  if (!getEntry(kind, slug)) return null;
  const mod = (await import(`./${kind}/${slug}.mdx`)) as { default: React.ComponentType };
  return mod.default;
}
