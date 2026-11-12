import { connection } from "next/server";
import { OrdersBrowser } from "@/components/account/OrdersBrowser";
import { PageHeader } from "@/components/account/ui";
import { buildUsuals, productInfo } from "@/lib/account/usuals";
import { getProducts } from "@/lib/commerce";
import {
  countAccountOrders,
  getAccountShell,
  queryAccountOrders,
  ORDER_RANGES,
  ORDER_TABS,
  type OrderRange,
  type OrderTab,
} from "@/lib/server/account";

export const metadata = { title: "My orders", robots: { index: false } };
// Per-session data: render per request (the layout opt-out does not cover sibling pages).
export const instant = false;

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function OrdersPage({ searchParams }: { searchParams: SP }) {
  await connection();
  const shell = await getAccountShell();
  if (!shell) return null; // layout redirects
  const sp = await searchParams;
  const tab = (ORDER_TABS as readonly string[]).includes(one(sp.status))
    ? (one(sp.status) as OrderTab)
    : "all";
  const range = (ORDER_RANGES as readonly string[]).includes(one(sp.range))
    ? (one(sp.range) as OrderRange)
    : "all";
  const q = one(sp.q).slice(0, 60);

  const [page, counts, products] = await Promise.all([
    queryAccountOrders(shell.customer.id, { tab, q, range }),
    countAccountOrders(shell.customer.id, { q, range }),
    getProducts(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="मेरे ऑर्डर"
        title="My orders"
        subtitle="Track, reorder and download invoices."
      />
      <OrdersBrowser
        initial={{ ...page, counts }}
        initialFilters={{ tab, q, range }}
        info={productInfo(products)}
        bestsellers={counts.all === 0 && !q && range === "all" ? buildUsuals(products, [], 6) : []}
      />
    </>
  );
}
