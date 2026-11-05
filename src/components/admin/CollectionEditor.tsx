"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ExternalLink,
  FileText,
  GripVertical,
  Home,
  ImageIcon,
  Loader2,
  Menu,
  Package,
  Plus,
  Search,
  X,
} from "lucide-react";
import { DropZone } from "@/components/admin/media/DropZone";
import { Switch } from "@/components/shadcn/switch";
import { saveCollectionAction } from "@/lib/collection-actions";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export type CollectionProduct = { handle: string; title: string; titleHi?: string; image: string; swatch?: string | null; status: string; from: number };
type Data = {
  handle: string;
  title: string;
  description: string;
  imageUrl: string;
  seoTitle: string;
  seoDescription: string;
  inMenu: boolean;
  menuOrder: number;
  showHomepage: boolean;
  products: string[];
};

const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const input =
  "h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-forest focus:ring-2 focus:ring-forest/15";
const area = cn(input, "h-auto py-2.5 leading-relaxed");

function Section({ icon: Icon, title, hint, aside, children }: { icon: typeof Menu; title: string; hint?: string; aside?: React.ReactNode; children: React.ReactNode }) {
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

function Thumb({ p, size = 40 }: { p: CollectionProduct; size?: number }) {
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <span className="block size-full overflow-hidden rounded-lg bg-subtle ring-1 ring-line">
        <Image src={p.image} alt="" width={size} height={size} className="size-full object-cover" unoptimized={p.image.endsWith(".svg")} />
      </span>
      {p.swatch && <span aria-hidden className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface" style={{ background: p.swatch }} />}
    </span>
  );
}

export function CollectionEditor({ initial, allProducts }: { initial: Data; allProducts: CollectionProduct[] }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [selected, setSelected] = useState(initial.products);
  const [saved, setSaved] = useState({ data: initial, selected: initial.products });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [q, setQ] = useState("");
  const patch = <K extends keyof Data>(key: K, value: Data[K]) => setData((cur) => ({ ...cur, [key]: value }));

  const dirty = JSON.stringify(data) !== JSON.stringify(saved.data) || selected.join() !== saved.selected.join();
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  async function save() {
    if (data.title.trim().length < 3) return setMsg({ ok: false, text: "Name needs at least 3 characters" });
    if (!slug(data.handle)) return setMsg({ ok: false, text: "Add a URL handle" });
    setBusy(true);
    setMsg(null);
    try {
      const result = await saveCollectionAction({ ...data, handle: slug(data.handle), products: selected }, initial.handle);
      setSaved({ data, selected });
      setMsg({ ok: true, text: "Saved. Store pages and menus are refreshed." });
      if (result.handle !== initial.handle) router.replace(`/admin/categories/${result.handle}`);
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not save collection" });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const byHandle = new Map(allProducts.map((p) => [p.handle, p]));
  const remaining = allProducts.filter((p) => !selected.includes(p.handle) && (!q || `${p.title} ${p.titleHi ?? ""}`.toLowerCase().includes(q.toLowerCase())));
  const seoTitle = data.seoTitle || data.title;
  const seoDesc = data.seoDescription || data.description.slice(0, 160);

  return (
    <div className="space-y-5">
      {/* Sticky header */}
      <div className="sticky top-16 z-20 -mx-4 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/admin/categories" aria-label="All collections" className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface text-forest-text hover:border-forest/50">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight text-forest-text sm:text-2xl">{data.title || "Untitled collection"}</h1>
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
              /collections/{slug(data.handle) || "…"} · {selected.length} product{selected.length === 1 ? "" : "s"}
              {dirty && <span className="font-semibold text-sale">· Unsaved changes</span>}
            </p>
          </div>
          <Link href={`/collections/${initial.handle}`} target="_blank" className="hidden h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-forest-text hover:border-forest/50 sm:inline-flex">
            <ExternalLink className="size-4" /> View on store
          </Link>
          {dirty && (
            <button type="button" disabled={busy} onClick={() => (setData(saved.data), setSelected(saved.selected), setMsg(null))} className="h-10 rounded-full px-3 text-sm font-semibold text-ink-muted hover:bg-khaki-soft">
              Discard
            </button>
          )}
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={() => void save()}
            title="⌘S"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest px-5 text-sm font-semibold text-white transition-colors hover:bg-forest-mid disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
        {msg && (
          <p className={cn("mt-2 flex items-center gap-1.5 text-sm", msg.ok ? "text-forest-fg" : "text-red-700")} role="status">
            {msg.ok ? <Check className="size-4" /> : <AlertCircle className="size-4" />} {msg.text}
          </p>
        )}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <Section
            icon={Package}
            title="Products"
            hint="Drag to set the order shoppers see on the collection page."
            aside={<span className="text-xs text-ink-muted">{selected.length} added</span>}
          >
            {selected.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">No products yet. Add some from the list below.</p>
            ) : (
              <Reorder.Group axis="y" values={selected} onReorder={setSelected} className="space-y-2">
                {selected.map((h, i) => {
                  const p = byHandle.get(h);
                  return p ? <SelectedRow key={h} p={p} index={i} onRemove={() => setSelected((cur) => cur.filter((x) => x !== h))} /> : null;
                })}
              </Reorder.Group>
            )}

            <div className="mt-5 border-t border-line pt-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-forest-text">Add products</p>
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products to add" className={cn(input, "h-9 rounded-full pl-9")} />
                </div>
              </div>
              {remaining.length === 0 ? (
                <p className="text-sm text-ink-muted">{q ? "No matching products." : "Every product is already in this collection."}</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {remaining.map((p) => (
                    <li key={p.handle}>
                      <button
                        type="button"
                        onClick={() => setSelected((cur) => [...cur, p.handle])}
                        className="group flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2 text-left transition-colors hover:border-forest/50 hover:bg-forest/5"
                      >
                        <Thumb p={p} size={36} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{p.title}</span>
                          <span className="block text-xs text-ink-muted">
                            {p.from ? `From ${formatMoney(p.from)}` : "No price"}
                            {p.status !== "active" && ` · ${p.status}`}
                          </span>
                        </span>
                        <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line text-forest-fg transition-colors group-hover:border-forest group-hover:bg-forest group-hover:text-white">
                          <Plus className="size-3.5" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Section>

          <Section icon={FileText} title="Details">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1.5 block font-semibold text-forest-text">Name</span>
                  <input className={input} value={data.title} onChange={(e) => patch("title", e.target.value)} maxLength={160} />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block font-semibold text-forest-text">URL handle</span>
                  <div className="flex h-10 items-center overflow-hidden rounded-xl border border-line bg-surface focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/15">
                    <span className="border-r border-line bg-subtle px-2.5 text-xs leading-10 text-ink-muted">/collections/</span>
                    <input className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm text-ink outline-none" value={data.handle} onChange={(e) => patch("handle", slug(e.target.value))} maxLength={80} />
                  </div>
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1.5 block font-semibold text-forest-text">Description</span>
                <textarea className={area} rows={4} value={data.description} onChange={(e) => patch("description", e.target.value)} maxLength={5000} placeholder="Shown at the top of the collection page." />
              </label>
            </div>
          </Section>

          <Section icon={Search} title="Search engine listing" hint="Leave blank to use the name and description.">
            <div className="mb-4 rounded-xl border border-line bg-subtle p-4">
              <p className="truncate text-xs text-ink-muted">swadeshimahadevproducts.com › collections › {slug(data.handle) || "…"}</p>
              <p className="mt-0.5 truncate text-lg leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{seoTitle || "Collection name"}</p>
              <p className="line-clamp-2 text-sm text-ink-muted">{seoDesc || "Description appears here."}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 flex justify-between font-semibold text-forest-text">
                  Page title <span className={cn("text-[11px] font-normal tabular-nums", seoTitle.length > 60 ? "text-sale" : "text-ink-muted")}>{seoTitle.length}/60</span>
                </span>
                <input className={input} value={data.seoTitle} onChange={(e) => patch("seoTitle", e.target.value)} maxLength={160} placeholder={data.title} />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 flex justify-between font-semibold text-forest-text">
                  Meta description <span className={cn("text-[11px] font-normal tabular-nums", seoDesc.length > 160 ? "text-sale" : "text-ink-muted")}>{seoDesc.length}/160</span>
                </span>
                <textarea className={area} rows={3} value={data.seoDescription} onChange={(e) => patch("seoDescription", e.target.value)} maxLength={320} />
              </label>
            </div>
          </Section>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-36">
          <Section icon={Menu} title="Visibility">
            <div className="space-y-2">
              <ToggleRow icon={Menu} label="Store menu" desc="Link in the header and footer" checked={data.inMenu} onChange={(v) => patch("inMenu", v)} />
              <ToggleRow icon={Home} label="Homepage" desc="Feature as a homepage section" checked={data.showHomepage} onChange={(v) => patch("showHomepage", v)} />
            </div>
          </Section>

          <Section icon={ImageIcon} title="Image" hint="Used on category tiles and the collection banner.">
            {data.imageUrl ? (
              <div className="relative overflow-hidden rounded-xl ring-1 ring-line">
                <Image src={data.imageUrl} alt={`${data.title} collection`} width={1200} height={675} className="aspect-[16/9] w-full object-cover" />
                <button type="button" onClick={() => patch("imageUrl", "")} aria-label="Remove image" className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-surface/90 text-red-700">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <DropZone folder="collections" multiple={false} label="Upload image" hint="Wide images work best" compact onUploaded={(images) => patch("imageUrl", images[0]?.url ?? "")} />
            )}
          </Section>
        </aside>
      </div>
    </div>
  );
}

function SelectedRow({ p, index, onRemove }: { p: CollectionProduct; index: number; onRemove: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={p.handle}
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.01, boxShadow: "0 12px 32px -12px rgba(0,0,0,.35)", zIndex: 10 }}
      className="relative flex items-center gap-3 rounded-xl border border-line bg-surface px-2 py-2"
    >
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        aria-label={`Drag to reorder ${p.title}`}
        className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-ink-muted hover:bg-khaki-soft hover:text-forest-fg active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="w-4 shrink-0 text-center text-xs font-semibold tabular-nums text-ink-muted">{index + 1}</span>
      <Thumb p={p} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{p.title}</span>
        <span className="block text-xs text-ink-muted">
          {p.from ? `From ${formatMoney(p.from)}` : "No price"}
          {p.status !== "active" && <span className="font-semibold text-sale"> · {p.status}, hidden on store</span>}
        </span>
      </span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${p.title}`} className="grid size-8 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-red-50 hover:text-red-700">
        <X className="size-4" />
      </button>
    </Reorder.Item>
  );
}

function ToggleRow({ icon: Icon, label, desc, checked, onChange }: { icon: typeof Menu; label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors", checked ? "border-forest/40 bg-forest/5" : "border-line")}>
      <Icon className={cn("size-4 shrink-0", checked ? "text-forest-fg" : "text-ink-muted")} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block text-xs text-ink-muted">{desc}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} className="data-[state=checked]:bg-forest" />
    </label>
  );
}
