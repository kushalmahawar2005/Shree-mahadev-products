import { notFound } from "next/navigation";
import { Card, Field, MockSave, PageHeader, inputCls } from "@/components/admin/ui";
import { getCollection, getCollections, getProducts } from "@/lib/commerce";

export async function generateStaticParams() {
  return (await getCollections()).map((c) => ({ handle: c.handle }));
}

export default async function EditCategory({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const [c, all] = await Promise.all([getCollection(handle), getProducts()]);
  if (!c) notFound();
  const inCat = new Set(c.products.map((p) => p.handle));
  return (
    <>
      <PageHeader title={c.title} intro={`/collections/${c.handle}`} />
      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card title="Details">
          <div className="space-y-4">
            <Field label="Name">
              <input className={inputCls} defaultValue={c.title} />
            </Field>
            <Field label="Handle (URL)">
              <input className={inputCls} defaultValue={c.handle} />
            </Field>
            <Field label="Description">
              <textarea className={`${inputCls} py-3`} rows={4} defaultValue={c.description} />
            </Field>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="size-5 accent-[var(--color-forest)]" />
              <span className="font-semibold text-forest-text">Show in header menu</span>
            </label>
          </div>
        </Card>
        <Card title={`Products (${inCat.size})`}>
          <ul className="max-h-96 space-y-1 overflow-y-auto">
            {all.map((p) => (
              <li key={p.handle}>
                <label className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-khaki-soft">
                  <input type="checkbox" defaultChecked={inCat.has(p.handle)} className="size-5 accent-[var(--color-forest)]" />
                  {p.title}
                </label>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="mt-6">
        <MockSave />
      </div>
    </>
  );
}
