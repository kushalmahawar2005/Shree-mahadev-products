import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { getStoreSettings } from "@/lib/server/store-settings";
import { formatMoney } from "@/lib/utils/money";

/** "₹999" from Admin → Settings → Free shipping above, so policy pages never go stale. */
async function FreeShippingAbove() {
  const { shipping } = await getStoreSettings();
  return <strong className="font-semibold text-forest-text">{formatMoney(shipping.freeShippingThreshold)}</strong>;
}

/** Styling for every MDX page (policies, recipes, journal). Readable 70ch column, brand colours. */
const components: MDXComponents = {
  h2: (p) => <h2 className="mt-10 mb-3 text-2xl text-forest-text md:text-[28px]" {...p} />,
  h3: (p) => <h3 className="mt-7 mb-2 text-lg font-semibold text-forest-text" {...p} />,
  p: (p) => <p className="my-4 leading-relaxed text-ink" {...p} />,
  ul: (p) => <ul className="my-4 list-disc space-y-2 pl-6 marker:text-mustard" {...p} />,
  ol: (p) => <ol className="my-4 list-decimal space-y-2 pl-6 marker:font-semibold marker:text-forest" {...p} />,
  li: (p) => <li className="leading-relaxed" {...p} />,
  strong: (p) => <strong className="font-semibold text-forest-text" {...p} />,
  hr: () => <hr className="my-10 border-line" />,
  FreeShippingAbove,
  blockquote: (p) => <blockquote className="my-6 rounded-2xl bg-khaki-soft px-5 py-4 text-forest-text" {...p} />,
  table: (p) => (
    <div className="my-6 overflow-x-auto rounded-2xl border border-line">
      <table className="w-full text-left text-sm" {...p} />
    </div>
  ),
  th: (p) => <th className="bg-khaki-soft/60 px-4 py-2 font-semibold" {...p} />,
  td: (p) => <td className="border-t border-line px-4 py-2 align-top" {...p} />,
  a: ({ href = "", ...p }) =>
    href.startsWith("/") ? (
      <Link href={href} className="font-semibold text-forest underline underline-offset-2" {...p} />
    ) : (
      <a href={href} className="font-semibold text-forest underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...p} />
    ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
