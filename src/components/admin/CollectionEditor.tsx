"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";
import { Card, Field, PageHeader, inputCls } from "@/components/admin/ui";
import { DropZone } from "@/components/admin/media/DropZone";
import { saveCollectionAction } from "@/lib/collection-actions";

type Product = { handle: string; title: string; titleHi?: string };
type Data = { handle: string; title: string; description: string; imageUrl: string; seoTitle: string; seoDescription: string; inMenu: boolean; menuOrder: number; showHomepage: boolean; products: string[] };
const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function CollectionEditor({ initial, allProducts }: { initial: Data; allProducts: Product[] }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [selected, setSelected] = useState(initial.products);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dragged, setDragged] = useState<string | null>(null);
  const patch = (key: keyof Data, value: Data[keyof Data]) => setData((current) => ({ ...current, [key]: value }));

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const result = await saveCollectionAction({ ...data, products: selected }, initial.handle);
      setMessage("Collection saved. Storefront pages and menus are refreshed.");
      if (result.handle !== initial.handle) router.replace(`/admin/categories/${result.handle}`);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save collection"); }
    finally { setBusy(false); }
  };
  const toggle = (handle: string) => setSelected((current) => current.includes(handle) ? current.filter((item) => item !== handle) : [...current, handle]);
  const move = (index: number, offset: number) => setSelected((current) => {
    const to = index + offset; if (to < 0 || to >= current.length) return current;
    const next = [...current]; [next[index], next[to]] = [next[to], next[index]]; return next;
  });
  const moveDragged = (target: string) => {
    if (!dragged || dragged === target) return;
    setSelected((current) => { const next = [...current]; const from = next.indexOf(dragged); const to = next.indexOf(target); const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; });
    setDragged(null);
  };

  const orderedProducts = selected.map((handle) => allProducts.find((product) => product.handle === handle)).filter((p): p is Product => !!p);
  const remaining = allProducts.filter((p) => !selected.includes(p.handle));

  return <>
    <PageHeader title={`Edit ${initial.title}`} intro={`/collections/${initial.handle}`} />
    <form onSubmit={save} className="space-y-5">
      {(error || message) && <p role={error ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm ${error ? "bg-sale/10 text-sale" : "bg-forest/10 text-forest"}`}>{error || message}</p>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)] [&>*]:min-w-0">
        <Card title="Collection details">
          <div className="space-y-4">
            <Field label="Name"><input className={inputCls} value={data.title} onChange={(e) => patch("title", e.target.value)} required minLength={3} maxLength={160} /></Field>
            <Field label="URL handle"><input className={inputCls} value={data.handle} onChange={(e) => patch("handle", slug(e.target.value))} required maxLength={80} /><span className="text-xs text-ink-muted">/collections/{slug(data.handle)}</span></Field>
            <Field label="Description"><textarea className={`${inputCls} py-3`} rows={5} value={data.description} onChange={(e) => patch("description", e.target.value)} maxLength={5000} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SEO title"><input className={inputCls} value={data.seoTitle} onChange={(e) => patch("seoTitle", e.target.value)} maxLength={160} /></Field>
              <Field label="SEO description"><textarea className={`${inputCls} py-3`} rows={3} value={data.seoDescription} onChange={(e) => patch("seoDescription", e.target.value)} maxLength={320} /></Field>
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card title="Collection image">
            <Field label="Cloudinary image URL"><input className={inputCls} type="url" value={data.imageUrl} onChange={(e) => patch("imageUrl", e.target.value)} placeholder="Upload an image below" /></Field>
            {data.imageUrl && <Image src={data.imageUrl} alt={`${data.title} collection preview`} width={1200} height={675} unoptimized className="mt-3 aspect-[16/9] w-full rounded-xl object-cover" />}
            <div className="mt-4"><DropZone folder="collections" multiple={false} label="Upload collection image" hint="Images upload directly to Cloudinary" compact onUploaded={(images) => patch("imageUrl", images[0]?.url ?? "")} /></div>
          </Card>
          <Card title="Visibility">
            <div className="space-y-3">
              <label className="flex min-h-12 items-center gap-3 rounded-xl border border-line px-3"><input type="checkbox" className="size-5 accent-[var(--color-forest)]" checked={data.inMenu} onChange={(e) => patch("inMenu", e.target.checked)} /><span className="font-medium text-forest-text">Show in header and footer menus</span></label>
              <label className="flex min-h-12 items-center gap-3 rounded-xl border border-line px-3"><input type="checkbox" className="size-5 accent-[var(--color-forest)]" checked={data.showHomepage} onChange={(e) => patch("showHomepage", e.target.checked)} /><span className="font-medium text-forest-text">Feature on homepage</span></label>
              <Field label="Menu order"><input className={inputCls} type="number" min={0} max={10000} value={data.menuOrder} onChange={(e) => patch("menuOrder", Math.max(0, Number(e.target.value) || 0))} /><span className="text-xs text-ink-muted">Use the Collections page arrows or drag to reorder the full list.</span></Field>
            </div>
          </Card>
        </div>
      </div>

      <Card title={`Products in this collection (${selected.length})`}>
        <p className="mb-3 text-sm text-ink-muted">Select products, then drag or use the arrow controls to choose their display order.</p>
        <ol className="space-y-2">
          {orderedProducts.map((product, index) => <li key={product.handle} draggable onDragStart={() => setDragged(product.handle)} onDragOver={(e) => e.preventDefault()} onDrop={() => moveDragged(product.handle)} className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-line bg-khaki-soft/50 p-2 sm:grid-cols-[1fr_auto_auto]">
            <div className="flex min-h-11 items-center gap-3 px-2"><span aria-hidden className="text-ink-muted">⠿</span><span className="min-w-0"><span className="block truncate font-medium text-forest-text">{product.title}</span><span className="block text-xs text-ink-muted">{product.handle}</span></span></div>
            <div className="flex items-center gap-2"><button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${product.title} up`} className="grid size-11 place-items-center rounded-full border border-line text-forest disabled:opacity-40">↑</button><button type="button" onClick={() => move(index, 1)} disabled={index === orderedProducts.length - 1} aria-label={`Move ${product.title} down`} className="grid size-11 place-items-center rounded-full border border-line text-forest disabled:opacity-40">↓</button></div>
            <button type="button" onClick={() => toggle(product.handle)} className="min-h-11 rounded-full px-4 text-sm font-semibold text-sale hover:bg-sale/10">Remove</button>
          </li>)}
        </ol>
        {remaining.length > 0 && <div className="mt-5 border-t border-line pt-4"><p className="mb-2 font-semibold text-forest-text">Add products</p><ul className="grid gap-1 sm:grid-cols-2">{remaining.map((product) => <li key={product.handle}><label className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-khaki-soft"><input type="checkbox" checked={false} onChange={() => toggle(product.handle)} className="size-5 accent-[var(--color-forest)]" /><span>{product.title}</span></label></li>)}</ul></div>}
      </Card>
      <div className="sticky bottom-3 z-10 flex justify-end rounded-2xl border border-line bg-white/95 p-3 shadow-lg backdrop-blur"><button disabled={busy} className="min-h-12 rounded-full bg-forest px-7 font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save collection"}</button></div>
    </form>
  </>;
}
