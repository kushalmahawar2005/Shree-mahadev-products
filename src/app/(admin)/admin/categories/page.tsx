import Link from "next/link";
import { Card, Field, MockSave, PageHeader, StatusBadge, Table, inputCls } from "@/components/admin/ui";
import { getCollections, getProducts } from "@/lib/commerce";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const collections = await getCollections();
  const counts = await Promise.all(collections.map(async (c) => (await getProducts({ collection: c.handle })).length));
  return (
    <>
      <PageHeader title="Categories" intro="Collections shown in the menu, shop filters and category pages." />
      <Table head={["Category", "Handle", "Products", "In menu", ""]}>
        {collections.map((c, i) => (
          <tr key={c.handle}>
            <td className="font-semibold">{c.title}</td>
            <td className="text-ink-muted">{c.handle}</td>
            <td>{counts[i]}</td>
            <td>
              <StatusBadge tone={["wood-pressed-oils", "raw-honey", "natural-sweeteners"].includes(c.handle) ? "green" : "gray"}>
                {["wood-pressed-oils", "raw-honey", "natural-sweeteners"].includes(c.handle) ? "Yes" : "No"}
              </StatusBadge>
            </td>
            <td>
              <Link href={`/admin/categories/${c.handle}`} className="font-semibold text-forest underline">
                Edit
              </Link>
            </td>
          </tr>
        ))}
      </Table>

      <Card title="Add category" className="mt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input className={inputCls} placeholder="e.g. Gift hampers" />
          </Field>
          <Field label="Handle (URL)">
            <input className={inputCls} placeholder="gift-hampers" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea className={`${inputCls} py-3`} rows={3} />
            </Field>
          </div>
        </div>
        <div className="mt-4">
          <MockSave label="Create category" />
        </div>
      </Card>
    </>
  );
}
