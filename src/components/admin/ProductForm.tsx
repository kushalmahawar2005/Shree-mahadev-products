"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Image from "next/image";
import { saveProductAction } from "@/lib/catalog-actions";
import { addProductImagesAction, type UploadedImage } from "@/lib/media-actions";
import { DropZone } from "./media/DropZone";
import type { ProductInput } from "@/lib/server/catalog";
import { cn } from "@/lib/utils/cn";

const input = "min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm focus:border-forest focus:outline-none";
const area = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm focus:border-forest focus:outline-none";

const slug = (s: string) =>
  s.toLowerCase().replace(/^(wood|cold)-pressed\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

type V = ProductInput["variants"][number];
const blankVariant = (): V => ({ title: "", sizeValue: 0, sizeUnit: "ml", price: 0, stock: null, available: true });

/** "1 L" → 1000 ml, "500 g" → 500 g. Keeps the form quick to fill. */
function parseSize(t: string): Pick<V, "sizeValue" | "sizeUnit"> | null {
  const m = t.trim().match(/^(\d+(?:\.\d+)?)\s*(ml|l|g|kg)$/i);
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  return u === "l" ? { sizeValue: n * 1000, sizeUnit: "ml" } : u === "kg" ? { sizeValue: n * 1000, sizeUnit: "g" } : { sizeValue: n, sizeUnit: u as "ml" | "g" };
}

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-4 md:p-5">
      <h2 className="text-lg font-semibold text-forest-text">{title}</h2>
      {hint && <p className="mb-3 text-sm text-ink-muted">{hint}</p>}
      <div className={cn(!hint && "mt-3")}>{children}</div>
    </section>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1 block font-semibold">{label}</span>
      {children}
    </label>
  );
}

export function ProductForm({
  initial,
  collections,
  isNew,
}: {
  initial: ProductInput;
  collections: { handle: string; title: string }[];
  isNew: boolean;
}) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [handleTouched, setHandleTouched] = useState(!isNew);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  // New products: photos are uploaded to Cloudinary right away and attached on "Create product".
  const [photos, setPhotos] = useState<UploadedImage[]>([]);
  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setP((x) => ({ ...x, [k]: v }));
  const setV = (i: number, patch: Partial<V>) => set("variants", p.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const listText = (a: string[]) => a.join("\n");
  const textList = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

  function save() {
    start(async () => {
      setMsg(null);
      try {
        const { handle } = await saveProductAction(p, isNew ? undefined : initial.handle);
        if (isNew && photos.length) await addProductImagesAction(handle, photos, p.title);
        setMsg({ ok: true, text: "Saved. Changes are live on the store." });
        if (isNew || handle !== initial.handle) router.replace(`/admin/products/edit?handle=${handle}`);
        else router.refresh();
      } catch (e) {
        setMsg({ ok: false, text: (e as Error).message || "Could not save" });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {isNew && (
            <Section title="Photos" hint="First photo is the main one. Square (1:1) photos look best. You can reorder them after saving.">
              <DropZone folder="products" onUploaded={(ups) => setPhotos((xs) => [...xs, ...ups])} />
              {photos.length > 0 && (
                <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {photos.map((ph, i) => (
                    <li key={ph.publicId} className="relative overflow-hidden rounded-xl border border-line bg-khaki-soft">
                      <Image src={ph.url} alt="" width={200} height={200} sizes="160px" className="aspect-square w-full object-cover" />
                      {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-forest px-2 text-xs text-white">Main</span>}
                      <button
                        type="button"
                        onClick={() => setPhotos((xs) => xs.filter((x) => x.publicId !== ph.publicId))}
                        className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-white/90 text-sm text-red-700"
                        aria-label="Remove photo"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
          <Section title="Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" className="sm:col-span-2">
                <input
                  className={input}
                  value={p.title}
                  onChange={(e) => {
                    set("title", e.target.value);
                    if (!handleTouched) set("handle", slug(e.target.value));
                  }}
                  placeholder="Wood-Pressed Groundnut Oil"
                />
              </Field>
              <Field label="Hindi name">
                <input className={input} lang="hi" value={p.titleHi} onChange={(e) => set("titleHi", e.target.value)} placeholder="मूंगफली तेल" />
              </Field>
              <Field label="URL handle">
                <input
                  className={input}
                  value={p.handle}
                  onChange={(e) => {
                    setHandleTouched(true);
                    set("handle", slug(e.target.value) || e.target.value.toLowerCase());
                  }}
                />
                <span className="mt-1 block text-xs text-ink-muted">/products/{p.handle || "…"}</span>
              </Field>
              <Field label="Short description (product card)" className="sm:col-span-2">
                <input className={input} value={p.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <textarea
                  className={area}
                  rows={5}
                  value={p.descriptionHtml.replace(/<\/p><p>/g, "\n\n").replace(/<\/?p>/g, "")}
                  onChange={(e) =>
                    set(
                      "descriptionHtml",
                      e.target.value
                        .split(/\n{2,}/)
                        .map((x) => x.trim())
                        .filter(Boolean)
                        .map((x) => `<p>${x.replace(/</g, "&lt;")}</p>`)
                        .join(""),
                    )
                  }
                />
                <span className="mt-1 block text-xs text-ink-muted">Leave an empty line between paragraphs.</span>
              </Field>
              <Field label="Benefits (one per line)">
                <textarea className={area} rows={4} value={listText(p.benefits)} onChange={(e) => set("benefits", textList(e.target.value))} />
              </Field>
              <Field label="Best for (one per line)">
                <textarea className={area} rows={4} value={listText(p.bestFor)} onChange={(e) => set("bestFor", textList(e.target.value))} />
              </Field>
              <Field label="How to use">
                <textarea className={area} rows={3} value={p.howToUse ?? ""} onChange={(e) => set("howToUse", e.target.value)} />
              </Field>
              <Field label="How it's made">
                <textarea className={area} rows={3} value={p.processNote ?? ""} onChange={(e) => set("processNote", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="Sizes & prices" hint='Type the size like "500 ml", "1 L" or "250 g". Leave stock empty if you do not track it.'>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-ink-muted">
                  <tr>
                    <th className="pb-2 font-semibold">Size</th>
                    <th className="pb-2 font-semibold">Price ₹</th>
                    <th className="pb-2 font-semibold">MRP ₹</th>
                    <th className="pb-2 font-semibold">Stock</th>
                    <th className="pb-2 font-semibold">Packed wt (g)</th>
                    <th className="pb-2 font-semibold">SKU</th>
                    <th className="pb-2 font-semibold">On sale</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {p.variants.map((v, i) => (
                    <tr key={i} className="align-top">
                      <td className="py-1 pr-2">
                        <input
                          className={cn(input, "w-24")}
                          value={v.title}
                          placeholder="1 L"
                          onChange={(e) => setV(i, { title: e.target.value, ...(parseSize(e.target.value) ?? {}) })}
                        />
                      </td>
                      <td className="py-1 pr-2">
                        <input className={cn(input, "w-24")} inputMode="numeric" value={v.price || ""} onChange={(e) => setV(i, { price: Number(e.target.value.replace(/\D/g, "")) })} />
                      </td>
                      <td className="py-1 pr-2">
                        <input className={cn(input, "w-24")} inputMode="numeric" value={v.compareAtPrice ?? ""} onChange={(e) => setV(i, { compareAtPrice: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : undefined })} />
                      </td>
                      <td className="py-1 pr-2">
                        <input className={cn(input, "w-20")} inputMode="numeric" placeholder="—" value={v.stock ?? ""} onChange={(e) => setV(i, { stock: e.target.value === "" ? null : Number(e.target.value.replace(/\D/g, "")) })} />
                      </td>
                      <td className="py-1 pr-2">
                        <input className={cn(input, "w-24")} inputMode="numeric" placeholder="auto" value={v.weightGrams ?? ""} onChange={(e) => setV(i, { weightGrams: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : undefined })} />
                      </td>
                      <td className="py-1 pr-2">
                        <input className={cn(input, "w-36")} value={v.sku ?? ""} onChange={(e) => setV(i, { sku: e.target.value })} />
                      </td>
                      <td className="py-1 pr-2 text-center">
                        <input type="checkbox" checked={v.available} onChange={(e) => setV(i, { available: e.target.checked })} className="mt-3 size-5 accent-[var(--color-forest)]" />
                      </td>
                      <td className="py-1">
                        <button type="button" onClick={() => set("variants", p.variants.filter((_, j) => j !== i))} className="min-h-11 px-2 text-red-700" aria-label={`Remove ${v.title || "size"}`}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => set("variants", [...p.variants, blankVariant()])} className="mt-3 min-h-10 rounded-full border border-forest px-4 text-sm font-semibold text-forest">
              + Add size
            </button>
          </Section>

          <Section title="FAQs">
            <div className="space-y-3">
              {p.faqs.map((f, i) => (
                <div key={i} className="grid gap-2 rounded-xl border border-line p-3">
                  <input className={input} placeholder="Question" value={f.q} onChange={(e) => set("faqs", p.faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
                  <textarea className={area} rows={2} placeholder="Answer" value={f.a} onChange={(e) => set("faqs", p.faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
                  <button type="button" onClick={() => set("faqs", p.faqs.filter((_, j) => j !== i))} className="justify-self-start text-sm text-red-700">
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => set("faqs", [...p.faqs, { q: "", a: "" }])} className="min-h-10 rounded-full border border-forest px-4 text-sm font-semibold text-forest">
                + Add FAQ
              </button>
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Status">
            <select className={input} value={p.status} onChange={(e) => set("status", e.target.value as ProductInput["status"])}>
              <option value="active">Active (visible on store)</option>
              <option value="draft">Draft (hidden)</option>
              <option value="archived">Archived</option>
            </select>
          </Section>
          <Section title="Organise">
            <div className="space-y-4">
              <Field label="Category">
                <select className={input} value={p.category} onChange={(e) => set("category", e.target.value as ProductInput["category"])}>
                  <option value="oil">Oil</option>
                  <option value="honey">Honey</option>
                  <option value="sweetener">Sweetener</option>
                </select>
              </Field>
              <div className="text-sm">
                <p className="mb-1 font-semibold">Collections</p>
                <div className="grid gap-1">
                  {collections.map((c) => (
                    <label key={c.handle} className="flex min-h-9 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={p.collections.includes(c.handle)}
                        onChange={(e) =>
                          set("collections", e.target.checked ? [...p.collections, c.handle] : p.collections.filter((x) => x !== c.handle))
                        }
                        className="size-4 accent-[var(--color-forest)]"
                      />
                      {c.title}
                    </label>
                  ))}
                </div>
              </div>
              <Field label="Tags (one per line)">
                <textarea className={area} rows={3} value={listText(p.tags)} onChange={(e) => set("tags", textList(e.target.value))} />
                <span className="mt-1 block text-xs text-ink-muted">&ldquo;bestseller&rdquo; puts it in Bestsellers.</span>
              </Field>
              <Field label="Colour swatch">
                <div className="flex gap-2">
                  <input type="color" value={p.swatch || "#D9B45A"} onChange={(e) => set("swatch", e.target.value.toUpperCase())} className="h-11 w-14 rounded-lg border border-line" />
                  <input className={input} value={p.swatch ?? ""} placeholder="#D9B45A" onChange={(e) => set("swatch", e.target.value)} />
                </div>
              </Field>
            </div>
          </Section>
          <Section title="Lab report & shelf life">
            <div className="space-y-4">
              <Field label="Lab report PDF link">
                <input className={input} value={p.labReportUrl ?? ""} onChange={(e) => set("labReportUrl", e.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Shelf life & storage">
                <input className={input} value={p.shelfLife ?? ""} onChange={(e) => set("shelfLife", e.target.value)} />
              </Field>
            </div>
          </Section>
          <Section title="SEO">
            <div className="space-y-4">
              <Field label="Page title">
                <input className={input} value={p.seoTitle ?? ""} onChange={(e) => set("seoTitle", e.target.value)} placeholder={p.title} />
              </Field>
              <Field label="Meta description">
                <textarea className={area} rows={3} value={p.seoDescription ?? ""} onChange={(e) => set("seoDescription", e.target.value)} placeholder={p.shortDescription} />
              </Field>
            </div>
          </Section>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-3 border-t border-line bg-white/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border">
        <button type="button" disabled={pending} onClick={save} className="min-h-11 rounded-full bg-forest px-6 font-semibold text-white hover:bg-forest-mid disabled:opacity-50">
          {pending ? "Saving…" : isNew ? "Create product" : "Save changes"}
        </button>
        {msg && <p className={cn("text-sm", msg.ok ? "text-forest" : "text-sale")}>{msg.text}</p>}
      </div>
    </div>
  );
}
