"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, Reorder, motion, useDragControls } from "motion/react";
import { BookOpen, Check, ExternalLink, GripVertical, ImageIcon, ListChecks, Loader2, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { unwrap } from "@/lib/action-result";
import { resetPdpStoryAction, savePdpStoryAction } from "@/lib/pdp-story-actions";
import { CHECK_ICONS, type Story } from "@/data/pdp-story";
import type { ProductCategory } from "@/lib/commerce/types";
import { ConfirmAction } from "@/components/admin/order/ConfirmAction";
import { DropZone } from "@/components/admin/media/DropZone";
import { Switch } from "@/components/shadcn/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { cn } from "@/lib/utils/cn";

type StoryMap = Partial<Record<ProductCategory, Story>>;
type Row<T> = T & { _id: string };
type Draft = {
  methodOn: boolean;
  method: { eyebrow: string; title: string; intro: string; steps: Row<{ title: string; body: string; image: string }>[] };
  checksOn: boolean;
  checks: { eyebrow: string; title: string; intro: string; items: Row<{ icon: (typeof CHECK_ICONS)[number]; title: string; body: string; image: string }>[] };
  reelsOn: boolean;
  reels: Row<{ video: string; link: string; cover: string; caption: string }>[];
};

const CATS: { id: ProductCategory; label: string }[] = [
  { id: "oil", label: "Oils" },
  { id: "honey", label: "Honey" },
  { id: "sweetener", label: "Jaggery & khand" },
];
const ICON_LABEL: Record<(typeof CHECK_ICONS)[number], string> = { smell: "Smell", cold: "Cold / fridge", look: "Look", pour: "Pour", taste: "Taste" };

const card = "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]";
const input =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none placeholder:text-ink-muted/70 focus:border-forest-fg focus:ring-2 focus:ring-forest/15";
const ghost = "inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-khaki-soft disabled:opacity-60";

let seq = 0;
const rid = () => `r${++seq}`;

function toDraft(s: Story | undefined): Draft {
  return {
    methodOn: !!s?.method,
    method: {
      eyebrow: s?.method?.eyebrow ?? "",
      title: s?.method?.title ?? "",
      intro: s?.method?.intro ?? "",
      steps: (s?.method?.steps ?? [{ title: "", body: "" }]).map((x) => ({ _id: rid(), title: x.title, body: x.body, image: x.image ?? "" })),
    },
    checksOn: !!s?.checks,
    checks: {
      eyebrow: s?.checks?.eyebrow ?? "",
      title: s?.checks?.title ?? "",
      intro: s?.checks?.intro ?? "",
      items: (s?.checks?.items ?? [{ icon: "smell" as const, title: "", body: "" }]).map((x) => ({ _id: rid(), icon: x.icon, title: x.title, body: x.body, image: x.image ?? "" })),
    },
    reelsOn: !!s?.reels?.length,
    reels: (s?.reels ?? []).map((r) => ({ _id: rid(), video: r.video ?? "", link: r.link ?? "", cover: r.cover ?? "", caption: r.caption })),
  };
}

function fromDraft(d: Draft): Story {
  const strip = <T extends { _id: string }>({ _id, ...rest }: T) => (void _id, rest);
  return {
    ...(d.methodOn && { method: { ...d.method, steps: d.method.steps.map(strip) } }),
    ...(d.checksOn && { checks: { ...d.checks, items: d.checks.items.map(strip) } }),

  };
}

const snapshot = (d: Draft) => JSON.stringify(fromDraft(d));

export function StoryEditor({ defaults, saved: initialSaved, cats }: { defaults: StoryMap; saved: StoryMap; cats: Record<ProductCategory, { count: number; href: string }> }) {
  const [cat, setCat] = useState<ProductCategory>("oil");
  const [saved, setSaved] = useState(initialSaved);
  const current = saved[cat] ?? defaults[cat];
  const [draft, setDraft] = useState<Draft>(() => toDraft(current));
  const [base, setBase] = useState(() => snapshot(toDraft(current)));
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = snapshot(draft) !== base;
  const custom = !!saved[cat];

  const load = (c: ProductCategory, map = saved) => {
    const d = toDraft(map[c] ?? defaults[c]);
    setCat(c);
    setDraft(d);
    setBase(snapshot(d));
  };

  const save = () =>
    start(async () => {
      setNotice(null);
      try {
        const story = fromDraft(draft);
        unwrap(await savePdpStoryAction(cat, story));
        setSaved((m) => ({ ...m, [cat]: story }));
        setBase(snapshot(draft));
        setNotice({ ok: true, text: "Saved. Product pages show the new story now." });
      } catch (e) {
        setNotice({ ok: false, text: e instanceof Error ? e.message : "Could not save" });
      }
    });

  const reset = () =>
    start(async () => {
      setNotice(null);
      try {
        unwrap(await resetPdpStoryAction(cat));
        const next = { ...saved };
        delete next[cat];
        setSaved(next);
        load(cat, next);
        setNotice({ ok: true, text: "Back to the built-in story." });
      } catch (e) {
        setNotice({ ok: false, text: e instanceof Error ? e.message : "Could not reset" });
      }
    });

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("keydown", key);
    };
  });

  const m = draft.method;
  const c = draft.checks;
  const setM = (p: Partial<Draft["method"]>) => setDraft((d) => ({ ...d, method: { ...d.method, ...p } }));
  const setC = (p: Partial<Draft["checks"]>) => setDraft((d) => ({ ...d, checks: { ...d.checks, ...p } }));

  return (
    <div className="space-y-6">
      <div className="sticky top-16 z-20 -mx-4 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-forest-text sm:text-3xl">Product page content</h1>
            <p className="text-sm text-ink-muted">The &ldquo;How it&apos;s made&rdquo; steps and &ldquo;Check it at home&rdquo; tips under the buy box. Set once per category, shown on every product in it.</p>
          </div>
          {dirty && <span className="text-sm font-medium text-sale">Unsaved changes</span>}
          {dirty && (
            <button type="button" className={ghost} onClick={() => load(cat)} disabled={pending}>
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || pending}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-forest px-5 text-sm font-semibold text-white hover:bg-forest-mid disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
            <kbd className="hidden rounded bg-white/15 px-1.5 text-[11px] sm:inline">⌘S</kbd>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-full border border-line bg-surface p-1" role="tablist" aria-label="Category">
          {CATS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={cat === t.id}
              onClick={() => load(t.id)}
              disabled={dirty && cat !== t.id}
              title={dirty && cat !== t.id ? "Save or discard first" : undefined}
              className={cn("relative h-9 rounded-full px-4 text-sm font-semibold disabled:opacity-50", cat === t.id ? "text-white" : "text-ink-muted hover:text-forest-fg")}
            >
              {cat === t.id && <motion.span layoutId="story-cat" className="absolute inset-0 rounded-full bg-forest" transition={{ type: "spring", bounce: 0.15, duration: 0.4 }} />}
              <span className="relative">{t.label}</span>
              <span className={cn("relative rounded-full px-1.5 text-[11px] tabular-nums", cat === t.id ? "bg-white/20" : "bg-khaki-soft")}>{cats[t.id].count}</span>
            </button>
          ))}
        </div>
        <a href={cats[cat].href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-forest-fg hover:underline">
          See on site <ExternalLink className="size-3.5" />
        </a>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", custom ? "bg-forest/10 text-forest-fg" : "bg-khaki-soft text-ink-muted")}>
          {custom ? "Customised" : "Using built-in copy"}
        </span>
        {custom && (
          <ConfirmAction
            trigger={
              <button type="button" className={cn(ghost, "ml-auto")} disabled={pending}>
                <RotateCcw className="size-4" /> Reset to built-in
              </button>
            }
            title="Use the built-in story again?"
            description="Your saved version for this category is removed. Product pages go back to the original copy."
            confirmLabel="Reset"
            destructive
            onConfirm={reset}
          />
        )}
      </div>

      <AnimatePresence>
        {notice && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role={notice.ok ? "status" : "alert"}
            className={cn("flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm", notice.ok ? "border-forest/20 bg-forest/10 text-forest-fg" : "border-warm-line bg-warm text-sale")}
          >
            {notice.ok ? <Check className="size-4" /> : <X className="size-4" />} {notice.text}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Method */}
      <Section icon={BookOpen} title="How it's made" hint="Step-by-step method with an illustration per step." on={draft.methodOn} onToggle={(v) => setDraft((d) => ({ ...d, methodOn: v }))}>
        <Heading eyebrow={m.eyebrow} title={m.title} intro={m.intro} onChange={setM} />
        <Reorder.Group axis="y" values={m.steps} onReorder={(steps) => setM({ steps })} className="space-y-3">
          {m.steps.map((s, i) => (
            <ItemCard key={s._id} value={s} index={i} onRemove={m.steps.length > 1 ? () => setM({ steps: m.steps.filter((x) => x._id !== s._id) }) : undefined}>
              <TextPair item={s} onChange={(p) => setM({ steps: m.steps.map((x) => (x._id === s._id ? { ...x, ...p } : x)) })} />
              <ImageField value={s.image} onChange={(image) => setM({ steps: m.steps.map((x) => (x._id === s._id ? { ...x, image } : x)) })} />
            </ItemCard>
          ))}
        </Reorder.Group>
        {m.steps.length < 8 && (
          <button type="button" className={ghost} onClick={() => setM({ steps: [...m.steps, { _id: rid(), title: "", body: "", image: "" }] })}>
            <Plus className="size-4" /> Add step
          </button>
        )}
      </Section>

      {/* Checks */}
      <Section icon={ListChecks} title="Check it at home" hint="Simple tests a shopper can do to know it's genuine." on={draft.checksOn} onToggle={(v) => setDraft((d) => ({ ...d, checksOn: v }))}>
        <Heading eyebrow={c.eyebrow} title={c.title} intro={c.intro} onChange={setC} />
        <Reorder.Group axis="y" values={c.items} onReorder={(items) => setC({ items })} className="space-y-3">
          {c.items.map((s, i) => (
            <ItemCard key={s._id} value={s} index={i} onRemove={c.items.length > 1 ? () => setC({ items: c.items.filter((x) => x._id !== s._id) }) : undefined}>
              <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                <label className="block text-xs font-medium text-ink-muted">
                  Icon
                  <Select value={s.icon} onValueChange={(icon) => setC({ items: c.items.map((x) => (x._id === s._id ? { ...x, icon: icon as typeof s.icon } : x)) })}>
                    <SelectTrigger className="mt-1 h-10 w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHECK_ICONS.map((k) => (
                        <SelectItem key={k} value={k}>
                          {ICON_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <TextPair item={s} onChange={(p) => setC({ items: c.items.map((x) => (x._id === s._id ? { ...x, ...p } : x)) })} />
              </div>
              <ImageField value={s.image} onChange={(image) => setC({ items: c.items.map((x) => (x._id === s._id ? { ...x, image } : x)) })} />
            </ItemCard>
          ))}
        </Reorder.Group>
        {c.items.length < 6 && (
          <button type="button" className={ghost} onClick={() => setC({ items: [...c.items, { _id: rid(), icon: "look", title: "", body: "", image: "" }] })}>
            <Plus className="size-4" /> Add check
          </button>
        )}
      </Section>

      <p className="rounded-xl border border-line bg-subtle px-4 py-3 text-sm text-ink-muted">
        Reels for product pages are on the <a href="/admin/videos" className="font-semibold text-forest-fg hover:underline">Reels</a> page. Tick &ldquo;{CATS.find((c) => c.id === cat)?.label}&rdquo; on a reel there.
      </p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  hint,
  on,
  onToggle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  on: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <section className={card}>
      <header className="flex items-center gap-3 border-b border-line px-5 py-4">
        <span className="flex size-9 items-center justify-center rounded-xl bg-khaki-soft text-forest-fg">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-ink">{title}</h2>
          <p className="text-xs text-ink-muted">{hint}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          {on ? "Shown" : "Hidden"}
          <Switch checked={on} onCheckedChange={onToggle} aria-label={`Show ${title}`} />
        </label>
      </header>
      <AnimatePresence initial={false}>
        {on && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-4 p-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Heading({ eyebrow, title, intro, onChange }: { eyebrow: string; title: string; intro: string; onChange: (p: { eyebrow?: string; title?: string; intro?: string }) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
      <label className="block text-xs font-medium text-ink-muted">
        Small line above (Hindi ok)
        <input value={eyebrow} maxLength={60} onChange={(e) => onChange({ eyebrow: e.target.value })} className={cn(input, "mt-1")} />
      </label>
      <label className="block text-xs font-medium text-ink-muted">
        Heading
        <input value={title} maxLength={120} onChange={(e) => onChange({ title: e.target.value })} className={cn(input, "mt-1 font-semibold")} />
      </label>
      <label className="block text-xs font-medium text-ink-muted sm:col-span-2">
        Intro line
        <input value={intro} maxLength={300} onChange={(e) => onChange({ intro: e.target.value })} className={cn(input, "mt-1")} />
      </label>
    </div>
  );
}

function TextPair({ item, onChange }: { item: { title: string; body: string }; onChange: (p: { title?: string; body?: string }) => void }) {
  return (
    <div className="grid flex-1 gap-2">
      <input value={item.title} maxLength={60} placeholder="Title" onChange={(e) => onChange({ title: e.target.value })} className={cn(input, "font-semibold")} aria-label="Title" />
      <textarea value={item.body} maxLength={240} rows={2} placeholder="One or two short sentences" onChange={(e) => onChange({ body: e.target.value })} className={cn(input, "resize-none")} aria-label="Text" />
    </div>
  );
}

function ImageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-subtle">
        {value ? <Image src={value} alt="" width={128} height={128} className="size-full object-cover" /> : <ImageIcon className="size-5 text-ink-muted" />}
      </span>
      <div className="min-w-0 flex-1">
        <DropZone folder="products" multiple={false} compact label={value ? "Replace image" : "Add image (optional)"} onUploaded={([u]) => u && onChange(u.url)} />
      </div>
      {value && (
        <button type="button" onClick={() => onChange("")} className="text-xs font-semibold text-ink-muted hover:text-sale">
          Remove
        </button>
      )}
    </div>
  );
}

function ItemCard<T extends { _id: string }>({ value, index, onRemove, children }: { value: T; index: number; onRemove?: () => void; children: React.ReactNode }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={value} dragListener={false} dragControls={controls} className="relative rounded-xl border border-line bg-surface p-3 pl-10">
      <button
        type="button"
        aria-label="Drag to reorder"
        onPointerDown={(e) => controls.start(e)}
        className="absolute top-3 left-2.5 cursor-grab touch-none text-ink-muted hover:text-ink active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="absolute top-9 left-3.5 text-[11px] font-semibold text-ink-muted tabular-nums">{index + 1}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Remove" className="absolute top-2.5 right-2.5 rounded-full p-1.5 text-ink-muted hover:bg-warm hover:text-sale">
          <Trash2 className="size-4" />
        </button>
      )}
      <div className="space-y-3 pr-8">{children}</div>
    </Reorder.Item>
  );
}

