import Image from "next/image";
import Link from "next/link";
import { PageHeader, StatusBadge, Table } from "@/components/admin/ui";
import { mockStock } from "@/data/admin";
import { getProducts } from "@/lib/commerce";
import { formatMoney } from "@/lib/utils/money";

export const metadata = { title: "Products" };

export default async function ProductsPage() {
  const products = await getProducts();
  return (
    <>
      <PageHeader title="Products" intro="One product = one oil/honey. Sizes are variants." />
      <Table head={["Product", "Category", "Variants", "Price", "Stock", "Status"]}>
        {products.map((p) => {
          const stock = p.variants.reduce((s, v) => s + mockStock(v.id), 0);
          const live = p.variants.some((v) => v.availableForSale);
          return (
            <tr key={p.handle}>
              <td>
                <Link href={`/admin/products/${p.handle}`} className="flex items-center gap-3 hover:underline">
                  <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg" style={{ backgroundColor: p.swatch ? `${p.swatch}55` : undefined }}>
                    <Image src={p.images[0].url} alt="" width={40} height={40} unoptimized className="size-10 object-contain" />
                  </span>
                  <span>
                    <span className="block font-semibold">{p.title}</span>
                    <span className="block text-sm text-ink-muted" lang="hi">
                      {p.titleHi}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="capitalize">{p.category}</td>
              <td>{p.variants.length}</td>
              <td>{p.priceRange.min.amount ? formatMoney(p.priceRange.min) : "TBD"}</td>
              <td>{live ? stock : "-"}</td>
              <td>
                <StatusBadge tone={live ? "green" : "amber"}>{live ? "Active" : "Price TBD"}</StatusBadge>
              </td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
