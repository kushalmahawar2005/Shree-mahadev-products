"use client";

import { unwrap } from "@/lib/action-result";
import { editableTextToHtml, htmlToEditableText } from "@/lib/utils/rich-text";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ExternalLink,
  FileText,
  FlaskConical,
  GripVertical,
  ImageIcon,
  Layers,
  Loader2,
  Plus,
  Receipt,
  Ruler,
  Search,
  Tag,
  Trash2,
  X,
  Clapperboard,
} from "lucide-react";
import { saveProductAction } from "@/lib/catalog-actions";
import { addProductImagesAction, type UploadedImage } from "@/lib/media-actions";
import { Switch } from "@/components/shadcn/switch";
import { DropZone } from "./media/DropZone";
import type { ProductInput } from "@/lib/server/catalog";
import { cn } from "@/lib/utils/cn";

const input =
  "h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-forest focus:ring-2 focus:ring-forest/15";
const area =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-forest focus:ring-2 focus:ring-forest/15";

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

const unitPrice = (v: V) => (v.price > 0 && v.sizeValue > 0 ? `₹${((v.price / v.sizeValue) * 100).toFixed(v.price / v.sizeValue < 0.1 ? 1 : 0)}/100${v.sizeUnit}` : null);
const discount = (v: V) => (v.compareAtPrice && v.price && v.compareAtPrice > v.price ? Math.round((1 - v.price / v.compareAtPrice) * 100) : 0);

function Section({ icon: Icon, title, hint, aside, children }: { icon: typeof FileText; title: string; hint?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,.04)]">
      <div className="mb-4 flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-khaki-soft text-forest-fg">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-forest-text">{title}</h2>
          {hint && <p className="text-xs text-ink-muted">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, count, max, children, className }: { label: string; hint?: string; count?: number; max?: number; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="font-semibold text-forest-text">{label}</span>
        {max !== undefined && count !== undefined && (
          <span className={cn("text-[11px] tabular-nums", count > max ? "font-semibold text-sale" : "text-ink-muted")}>
            {count}/{max}
          </span>
        )}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

/** Pill input: Enter or comma adds a tag. */
function TagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface p-1.5 focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/15">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-khaki-soft py-0.5 pl-2.5 pr-1 text-xs font-medium text-forest-text">
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="grid size-4 place-items-center rounded-full hover:bg-forest/15">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
        placeholder={value.length ? "" : "daily-cooking, bestseller…"}
        className="h-7 min-w-24 flex-1 bg-transparent px-1.5 text-sm text-ink outline-none placeholder:text-ink-muted/70"
      />
    </div>
  );
}

const STATUS_OPTS = [
  { id: "active", label: "Active", desc: "Visible and buyable on the store" },
  { id: "draft", label: "Draft", desc: "Hidden while you finish it" },
  { id: "archived", label: "Archived", desc: "No longer sold, kept for records" },
] as const;

export function ProductForm({
  initial,
  collections,
  isNew,
  photos: photos_,
  videos,
}: {
  initial: ProductInput;
  collections: { handle: string; title: string }[];
  isNew: boolean;
  /** Photo manager for existing products; new products get an uploader here. */
  photos?: React.ReactNode;
  /** Edit page only: this product's own videos. */
  videos?: React.ReactNode;
}) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [handleTouched, setHandleTouched] = useState(!isNew);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  // New products: photos are uploaded to Cloudinary right away and attached on "Create product".
  const [photos, setPhotos] = useState<UploadedImage[]>([]);
  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setP((x) => ({ ...x, [k]: v }));
  const setV = (i: number, patch: Partial<V>) => set("variants", p.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const listText = (a: string[]) => a.join("\n");
  const textList = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

  const dirty = JSON.stringify(p) !== JSON.stringify(saved) || photos.length > 0;
  const problems = [
    !p.title.trim() && "Add a title",
    !p.handle.trim() && "Add a URL handle",
    !p.variants.length && "Add at least one size",
    p.variants.some((v) => !v.title.trim()) && "Every size needs a name like “1 L”",
    p.variants.some((v) => v.title.trim() && !parseSize(v.title)) && "Size names must look like 500 ml, 1 L, 250 g or 1 kg",
    p.status === "active" && p.variants.some((v) => v.available && !v.price) && "Sizes on sale need a price",
    p.variants.some((v) => v.compareAtPrice && v.compareAtPrice < v.price) && "MRP can't be below the price",
  ].filter(Boolean) as string[];

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function save() {
    if (problems.length) {
      setMsg({ ok: false, text: problems[0] });
      return;
    }
    start(async () => {
      setMsg(null);
      try {
        const { handle } = unwrap(await saveProductAction(p, isNew ? undefined : initial.handle));
        if (isNew && photos.length) unwrap(await addProductImagesAction(handle, photos, p.title));
        setSaved(p);
        setPhotos([]);
        setMsg({ ok: true, text: isNew ? "Product created." : "Saved. Changes are live on the store." });
        if (isNew || handle !== initial.handle) router.replace(`/admin/products/edit?handle=${handle}`);
        else router.refresh();
      } catch (e) {
        setMsg({ ok: false, text: (e as Error).message || "Could not save" });
      }
    });
  }

  // ⌘S / Ctrl+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const photosSlot = photos_ ?? (
    <>
      <DropZone folder="products" compact label="Drop photos or click" onUploaded={(ups) => setPhotos((xs) => [...xs, ...ups])} />
      {photos.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {photos.map((ph, i) => (
            <li key={ph.publicId} className="relative overflow-hidden rounded-xl border border-line bg-khaki-soft">
              <Image src={ph.url} alt="" width={200} height={200} sizes="160px" className="aspect-square w-full object-cover" />
              {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-forest px-2 text-[11px] font-semibold text-white">Main</span>}
              <button
                type="button"
                onClick={() => setPhotos((xs) => xs.filter((x) => x.publicId !== ph.publicId))}
                className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-surface/90 text-red-700"
                aria-label="Remove photo"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-muted">Photos upload now and attach when you create the product. First photo is the main one.</p>
    </>
  );

  const seoTitle = p.seoTitle || `${p.title}${p.titleHi ? ` (${p.titleHi})` : ""}`;
  const seoDesc = p.seoDescription || p.shortDescription;
  const statusNow = STATUS_OPTS.find((s) => s.id === p.status)!;

  return (
    <div className="space-y-5">
      {/* Sticky header */}
      <div className="sticky top-16 z-20 -mx-4 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/admin/products" aria-label="All products" className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface text-forest-text hover:border-forest/50">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight text-forest-text sm:text-2xl">{p.title || (isNew ? "New product" : "Untitled")}</h1>
            <p className="flex items-center gap-2 text-xs text-ink-muted">
              <span className={cn("inline-flex items-center gap-1 font-semibold", p.status === "active" ? "text-forest-fg" : p.status === "draft" ? "text-sale" : "text-ink-muted")}>
                <span className={cn("size-1.5 rounded-full", p.status === "active" ? "bg-forest-fg" : p.status === "draft" ? "bg-mustard" : "bg-ink-muted/50")} />
                {statusNow.label}
              </span>
              {p.titleHi && <span lang="hi">· {p.titleHi}</span>}
              {dirty && <span className="font-semibold text-sale">· Unsaved changes</span>}
            </p>
          </div>
          {!isNew && (
            <Link href={`/products/${initial.handle}`} target="_blank" className="hidden h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-forest-text hover:border-forest/50 sm:inline-flex">
              <ExternalLink className="size-4" /> View on store
            </Link>
          )}
          {dirty && !isNew && (
            <button type="button" disabled={pending} onClick={() => (setP(saved), setMsg(null))} className="h-10 rounded-full px-3 text-sm font-semibold text-ink-muted hover:bg-khaki-soft">
              Discard
            </button>
          )}
          <button
            type="button"
            disabled={pending || (!dirty && !isNew)}
            onClick={save}
            title="⌘S"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest px-5 text-sm font-semibold text-white transition-colors hover:bg-forest-mid disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {pending ? "Saving…" : isNew ? "Create product" : "Save"}
          </button>
        </div>
        {msg && (
          <p className={cn("mt-2 flex items-center gap-1.5 text-sm", msg.ok ? "text-forest-fg" : "text-red-700")} role="status">
            {msg.ok ? <Check className="size-4" /> : <AlertCircle className="size-4" />} {msg.text}
          </p>
        )}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main column */}
        <div className="min-w-0 space-y-5">
          <Section icon={FileText} title="Basics" hint="What shoppers see first on the product card and page.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" className="sm:col-span-2">
                <input
                  className={cn(input, "h-11 text-base font-medium")}
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
                <div className="flex h-10 items-center overflow-hidden rounded-xl border border-line bg-surface focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/15">
                  <span className="border-r border-line bg-subtle px-2.5 text-xs leading-10 text-ink-muted">/products/</span>
                  <input
                    className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm text-ink outline-none"
                    value={p.handle}
                    onChange={(e) => {
                      setHandleTouched(true);
                      set("handle", slug(e.target.value) || e.target.value.toLowerCase());
                    }}
                    placeholder="groundnut-oil"
                  />
                </div>
              </Field>
              <Field label="Short description" hint="One line on the product card." count={p.shortDescription.length} max={90} className="sm:col-span-2">
                <input className={input} value={p.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} placeholder="Nutty, everyday cooking oil from slow-pressed groundnuts." />
              </Field>
            </div>
          </Section>

          <Section icon={Layers} title="Product story" hint="Shown in the PDP accordions. Keep it honest and simple.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="About" hint="Shown under &quot;About&quot; on the product page. Leave an empty line between paragraphs. Put **two stars** around words to make them bold." className="sm:col-span-2">
                <textarea
                  className={area}
                  rows={5}
                  value={htmlToEditableText(p.descriptionHtml)}
                  onChange={(e) => set("descriptionHtml", editableTextToHtml(e.target.value))}
                />
              </Field>
              <Field label="Benefits" hint={`One per line · ${p.benefits.length} added (3–5 works best) · **text** = bold`}>
                <textarea className={area} rows={4} value={listText(p.benefits)} onChange={(e) => set("benefits", textList(e.target.value))} placeholder={"Natural nutty aroma\nHigh smoke point"} />
              </Field>
              <Field label="Best for" hint={`One per line · ${p.bestFor.length} added`}>
                <textarea className={area} rows={4} value={listText(p.bestFor)} onChange={(e) => set("bestFor", textList(e.target.value))} placeholder={"Daily cooking\nDeep frying"} />
              </Field>
              <Field label="How to use" hint="**text** = bold">
                <textarea className={area} rows={3} value={p.howToUse ?? ""} onChange={(e) => set("howToUse", e.target.value)} />
              </Field>
              <Field label="How it&apos;s made" hint="**text** = bold">
                <textarea className={area} rows={3} value={p.processNote ?? ""} onChange={(e) => set("processNote", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section
            icon={Ruler}
            title="Sizes & prices"
            hint='Type sizes like "500 ml", "1 L" or "250 g". Leave stock empty if you don&apos;t track it.'
            aside={<span className="text-xs text-ink-muted">{p.variants.length} size{p.variants.length === 1 ? "" : "s"}</span>}
          >
            <div className="space-y-2">
              <div className="hidden grid-cols-[minmax(84px,1fr)_minmax(84px,1fr)_minmax(84px,1fr)_minmax(72px,.8fr)_minmax(80px,.8fr)_minmax(120px,1.4fr)_56px_32px] gap-2 px-1 text-[11px] font-semibold text-ink-muted lg:grid">
                <span>Size</span>
                <span>Price ₹</span>
                <span>MRP ₹</span>
                <span>Stock</span>
                <span>Packed g</span>
                <span>SKU</span>
                <span className="text-center">On sale</span>
                <span />
              </div>
              {p.variants.map((v, i) => {
                const off = discount(v);
                const up = unitPrice(v);
                const badSize = v.title.trim() !== "" && !parseSize(v.title);
                return (
                  <div key={v.key ?? i} className={cn("rounded-xl border border-line p-3 transition-colors lg:border-0 lg:p-0", !v.available && "opacity-60")}>
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(84px,1fr)_minmax(84px,1fr)_minmax(84px,1fr)_minmax(72px,.8fr)_minmax(80px,.8fr)_minmax(120px,1.4fr)_56px_32px] lg:items-center">
                      <label className="col-span-2 lg:col-span-1">
                        <span className="mb-1 block text-[11px] font-semibold text-ink-muted lg:hidden">Size</span>
                        <input
                          className={cn(input, badSize && "border-red-300 focus:border-red-500 focus:ring-red-500/15")}
                          value={v.title}
                          placeholder="1 L"
                          aria-label="Size"
                          onChange={(e) => setV(i, { title: e.target.value, ...(parseSize(e.target.value) ?? {}) })}
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-[11px] font-semibold text-ink-muted lg:hidden">Price ₹</span>
                        <input className={cn(input, "tabular-nums")} inputMode="numeric" aria-label="Price" value={v.price || ""} onChange={(e) => setV(i, { price: Number(e.target.value.replace(/\D/g, "")) })} />
                      </label>
                      <label>
                        <span className="mb-1 block text-[11px] font-semibold text-ink-muted lg:hidden">MRP ₹</span>
                        <input
                          className={cn(input, "tabular-nums")}
                          inputMode="numeric"
                          aria-label="MRP"
                          value={v.compareAtPrice ?? ""}
                          onChange={(e) => setV(i, { compareAtPrice: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : undefined })}
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-[11px] font-semibold text-ink-muted lg:hidden">Stock</span>
                        <input
                          className={cn(input, "tabular-nums")}
                          inputMode="numeric"
                          placeholder="—"
                          aria-label="Stock"
                          value={v.stock ?? ""}
                          onChange={(e) => setV(i, { stock: e.target.value === "" ? null : Number(e.target.value.replace(/\D/g, "")) })}
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-[11px] font-semibold text-ink-muted lg:hidden">Packed g</span>
                        <input
                          className={cn(input, "tabular-nums")}
                          inputMode="numeric"
                          placeholder="auto"
                          aria-label="Packed weight in grams"
                          value={v.weightGrams ?? ""}
                          onChange={(e) => setV(i, { weightGrams: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : undefined })}
                        />
                      </label>
                      <label className="col-span-2 lg:col-span-1">
                        <span className="mb-1 block text-[11px] font-semibold text-ink-muted lg:hidden">SKU</span>
                        <input className={cn(input, "font-mono text-xs")} aria-label="SKU" value={v.sku ?? ""} onChange={(e) => setV(i, { sku: e.target.value })} />
                      </label>
                      <span className="flex items-center gap-2 lg:justify-center">
                        <Switch checked={v.available} onCheckedChange={(c) => setV(i, { available: c })} aria-label={`${v.title || "Size"} on sale`} className="data-[state=checked]:bg-forest" />
                        <span className="text-xs text-ink-muted lg:hidden">On sale</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => set("variants", p.variants.filter((_, j) => j !== i))}
                        className="grid size-8 place-items-center justify-self-end rounded-full text-ink-muted transition-colors hover:bg-red-50 hover:text-red-700"
                        aria-label={`Remove ${v.title || "size"}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    {(off > 0 || up || (v.stock !== null && v.stock <= 5)) && (
                      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-ink-muted">
                        {up && <span>{up}</span>}
                        {off > 0 && <span className={cn("font-semibold", off >= 10 ? "text-forest-fg" : "text-ink-muted")}>{off}% off{off >= 10 ? " · badge shows" : ""}</span>}
                        {v.stock !== null && v.stock <= 5 && <span className="font-semibold text-sale">{v.stock === 0 ? "Out of stock" : "Low stock"}</span>}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => set("variants", [...p.variants, blankVariant()])}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-forest/50 px-4 text-sm font-semibold text-forest-fg transition-colors hover:bg-forest/5"
            >
              <Plus className="size-4" /> Add size
            </button>
            {p.variants.some((v) => v.title.trim()) && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-sm font-semibold text-ink">Shown first</p>
                <p className="mt-0.5 text-xs text-ink-muted">The size cards and the product page open on. Auto = cheapest on cards, 1 L / 1 kg on the page.</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Size shown first">
                  {[{ value: "", label: "Auto" }, ...p.variants.filter((v) => v.title.trim()).map((v) => ({ value: v.title.trim(), label: v.title.trim() }))].map((o) => {
                    const on = (p.defaultSize ?? "").toLowerCase() === o.value.toLowerCase();
                    return (
                      <button
                        key={o.value || "auto"}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => set("defaultSize", o.value || undefined)}
                        className={cn(
                          "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors",
                          on ? "border-forest bg-forest text-white" : "border-line bg-surface text-ink hover:bg-khaki-soft",
                        )}
                      >
                        {on && <Check className="size-3.5" />}
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Section>

          <Section
            icon={GripVertical}
            title="FAQs"
            hint="Shown on the product page and in Google results."
            aside={<span className="text-xs text-ink-muted">{p.faqs.length}</span>}
          >
            <div className="space-y-3">
              {p.faqs.map((f, i) => (
                <div key={i} className="group relative rounded-xl border border-line bg-subtle p-3 pl-10">
                  <span className="absolute left-3 top-3.5 grid size-5 place-items-center rounded-full bg-khaki-soft text-[11px] font-bold text-forest-fg">{i + 1}</span>
                  <input
                    className={cn(input, "font-medium")}
                    placeholder="Question"
                    aria-label={`Question ${i + 1}`}
                    value={f.q}
                    onChange={(e) => set("faqs", p.faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))}
                  />
                  <textarea
                    className={cn(area, "mt-2")}
                    rows={2}
                    placeholder="Answer"
                    aria-label={`Answer ${i + 1}`}
                    value={f.a}
                    onChange={(e) => set("faqs", p.faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
                  />
                  <button
                    type="button"
                    onClick={() => set("faqs", p.faqs.filter((_, j) => j !== i))}
                    className="absolute right-2 top-2 grid size-7 place-items-center rounded-full text-ink-muted opacity-0 transition hover:bg-red-50 hover:text-red-700 focus:opacity-100 group-hover:opacity-100"
                    aria-label={`Remove question ${i + 1}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => set("faqs", [...p.faqs, { q: "", a: "" }])}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-forest/50 px-4 text-sm font-semibold text-forest-fg transition-colors hover:bg-forest/5"
              >
                <Plus className="size-4" /> Add question
              </button>
            </div>
          </Section>

          <Section icon={Search} title="Search engine listing" hint="How this page can look on Google. Leave blank to use the title and short description.">
            <div className="mb-4 rounded-xl border border-line bg-subtle p-4">
              <p className="truncate text-xs text-ink-muted">swadeshimahadevproducts.in › products › {p.handle || "…"}</p>
              <p className="mt-0.5 truncate text-lg leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{seoTitle || "Product title"}</p>
              <p className="line-clamp-2 text-sm text-ink-muted">{seoDesc || "Short description appears here."}</p>
            </div>
            <div className="space-y-4">
              <Field label="Page title" count={seoTitle.length} max={60}>
                <input className={input} value={p.seoTitle ?? ""} onChange={(e) => set("seoTitle", e.target.value)} placeholder={seoTitle} />
              </Field>
              <Field label="Meta description" count={seoDesc.length} max={160}>
                <textarea className={area} rows={3} value={p.seoDescription ?? ""} onChange={(e) => set("seoDescription", e.target.value)} placeholder={p.shortDescription} />
              </Field>
            </div>
          </Section>
        </div>

        {/* Side column */}
        <aside className="min-w-0 space-y-5 xl:sticky xl:top-36">
          <Section icon={Check} title="Status">
            <div role="radiogroup" aria-label="Status" className="space-y-2">
              {STATUS_OPTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={p.status === s.id}
                  onClick={() => set("status", s.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                    p.status === s.id ? "border-forest bg-forest/5 ring-1 ring-forest" : "border-line hover:border-forest/40",
                  )}
                >
                  <span className={cn("grid size-4 shrink-0 place-items-center rounded-full border-2", p.status === s.id ? "border-forest-fg" : "border-line")}>
                    {p.status === s.id && <span className="size-2 rounded-full bg-forest-fg" />}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">{s.label}</span>
                    <span className="block text-xs text-ink-muted">{s.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <Section icon={ImageIcon} title="Photos" hint="Square photos look best. First photo is the main one.">
            {photosSlot}
          </Section>

          {videos && (
            <Section icon={Clapperboard} title="Product videos" hint="Short clips shown on this product's page, next to Add to cart.">
              {videos}
            </Section>
          )}

          <Section icon={Tag} title="Organise">
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-sm font-semibold text-forest-text">Category</p>
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-subtle p-1">
                  {(["oil", "honey", "sweetener"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={p.category === c}
                      onClick={() => set("category", c)}
                      className={cn("h-8 rounded-lg text-xs font-semibold capitalize transition-colors", p.category === c ? "bg-surface text-forest-text shadow-sm" : "text-ink-muted hover:text-ink")}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-semibold text-forest-text">Collections</p>
                <div className="flex flex-wrap gap-1.5">
                  {collections.map((c) => {
                    const on = p.collections.includes(c.handle);
                    return (
                      <button
                        key={c.handle}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set("collections", on ? p.collections.filter((x) => x !== c.handle) : [...p.collections, c.handle])}
                        className={cn(
                          "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors",
                          on ? "border-forest bg-forest text-white" : "border-line text-ink hover:border-forest/50",
                        )}
                      >
                        {on && <Check className="size-3" />}
                        {c.title}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Field label="Tags" hint="“bestseller” puts it in Bestsellers. Use-case tags power Shop by use.">
                <TagInput value={p.tags} onChange={(t) => set("tags", t)} />
              </Field>
              <Field label="Colour swatch" hint="Used on the oil shelf and product cards.">
                <div className="flex gap-2">
                  <input type="color" value={p.swatch || "#D9B45A"} onChange={(e) => set("swatch", e.target.value.toUpperCase())} className="h-10 w-12 shrink-0 cursor-pointer rounded-xl border border-line bg-surface p-1" aria-label="Pick colour" />
                  <input className={cn(input, "font-mono")} value={p.swatch ?? ""} placeholder="#D9B45A" onChange={(e) => set("swatch", e.target.value)} />
                </div>
              </Field>
            </div>
          </Section>

          <Section icon={Receipt} title="Tax" hint="Printed on GST invoices.">
            <div className="grid grid-cols-2 gap-3">
              <Field label="HSN code">
                <input className={cn(input, "tabular-nums")} inputMode="numeric" maxLength={10} value={p.hsn ?? ""} onChange={(e) => set("hsn", e.target.value.replace(/\D/g, "").slice(0, 10) || undefined)} placeholder="15079010" />
              </Field>
              <Field label="GST %">
                <input className={cn(input, "tabular-nums")} type="number" min={0} max={100} step="0.01" value={p.gstRate ?? ""} onChange={(e) => set("gstRate", e.target.value === "" ? undefined : Number(e.target.value))} placeholder="5" />
              </Field>
            </div>
            {(!p.hsn || p.gstRate == null) && <p className="mt-2 text-xs text-sale">Invoices can&apos;t be created until HSN and GST are set.</p>}
          </Section>

          <Section icon={FlaskConical} title="Lab report & shelf life">
            <div className="space-y-4">
              <Field label="Lab report PDF link">
                <input className={input} value={p.labReportUrl ?? ""} onChange={(e) => set("labReportUrl", e.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Shelf life & storage">
                <textarea className={area} rows={2} value={p.shelfLife ?? ""} onChange={(e) => set("shelfLife", e.target.value)} placeholder="Best within 9 months. Store cool and dry." />
              </Field>
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}
