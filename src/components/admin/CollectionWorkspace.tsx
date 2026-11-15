"use client";

import { unwrap } from "@/lib/action-result";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  FolderTree,
  GripVertical,
  Home,
  Loader2,
  Lock,
  Menu,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { DropZone } from "@/components/admin/media/DropZone";
import { deleteCollectionAction, reorderCollectionsAction, saveCollectionAction } from "@/lib/collection-actions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/shadcn/alert-dialog";
import { cn } from "@/lib/utils/cn";

type Row = {
  id: number;
  handle: string;
  title: string;
  description: string;
  imageUrl: string;
  seoTitle: string;
  seoDescription: string;
  inMenu: boolean;
  menuOrder: number;
  showHomepage: boolean;
  sortOrder: number;
  active: boolean;
  productCount: number;
};

/** Core collections the storefront nav and routes depend on. */
const PROTECTED = new Set(["wood-pressed-oils", "raw-honey", "natural-sweeteners", "bestsellers"]);
const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const card = "rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]";
const input =
  "h-10 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-forest focus:ring-2 focus:ring-forest/15";

export function CollectionWorkspace({ initialRows }: { initialRows: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(() => [...initialRows].sort((a, b) => a.sortOrder - b.sortOrder));
  const [savedOrder, setSavedOrder] = useState(() => rows.map((r) => r.handle).join());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);

  const inMenu = rows.filter((r) => r.inMenu).length;
  const onHome = rows.filter((r) => r.showHomepage).length;
  const empty = rows.filter((r) => r.productCount === 0).length;

  async function persistOrder(next: Row[]) {
    const key = next.map((r) => r.handle).join();
    if (key === savedOrder) return;
    setBusy(true);
    setMsg(null);
    try {
      unwrap(await reorderCollectionsAction(next.map((r) => r.handle)));
      setSavedOrder(key);
      setMsg({ ok: true, text: "Order saved. The store menu updates right away." });
    } catch (e) {
      setRows([...initialRows].sort((a, b) => a.sortOrder - b.sortOrder));
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not save order" });
    } finally {
      setBusy(false);
    }
  }

  const move = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    [next[index], next[to]] = [next[to], next[index]];
    setRows(next);
    void persistOrder(next);
  };

  async function remove(row: Row) {
    setBusy(true);
    setMsg(null);
    try {
      unwrap(await deleteCollectionAction(row.handle));
      setRows((cur) => cur.filter((r) => r.handle !== row.handle));
      setMsg({ ok: true, text: `“${row.title}” deleted. Its products are unchanged.` });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not delete collection" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-forest-text">Collections</h1>
          <p className="mt-1 text-sm text-ink-muted">Group products into store pages, menu links and homepage sections.</p>
        </div>
        <CreateCollection
          nextOrder={rows.length}
          onCreated={(row) => {
            setRows((cur) => [...cur, row]);
            setSavedOrder((k) => `${k},${row.handle}`);
            setMsg({ ok: true, text: `“${row.title}” created. Add products to it from Edit.` });
            router.refresh();
          }}
        />
      </div>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Collections summary">
        <Stat icon={FolderTree} label="Collections" value={rows.length} note={`${PROTECTED.size} core, can't be deleted`} />
        <Stat icon={Menu} label="In store menu" value={inMenu} note="shown in the header nav" />
        <Stat icon={Home} label="On homepage" value={onHome} note="as homepage sections" />
        <Stat icon={Package} label="Empty" value={empty} note="no products yet" tone={empty ? "warn" : undefined} />
      </section>

      <section className={cn(card, "overflow-hidden")}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-forest-text">Store order</h2>
            <p className="text-xs text-ink-muted">Drag the handle to reorder. This is the order used in menus and on the shop page.</p>
          </div>
          {busy && (
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
              <Loader2 className="size-3.5 animate-spin" /> Saving…
            </span>
          )}
        </div>
        {msg && (
          <p className={cn("flex items-center gap-2 border-b border-line px-5 py-2.5 text-sm", msg.ok ? "bg-forest/10 text-forest-fg" : "bg-red-50 text-red-800")} role={msg.ok ? "status" : "alert"}>
            {msg.ok ? <Check className="size-4" /> : <X className="size-4" />} {msg.text}
          </p>
        )}

        <Reorder.Group axis="y" values={rows} onReorder={setRows} className="divide-y divide-line">
          {rows.map((row, index) => (
            <CollectionItem
              key={row.handle}
              row={row}
              index={index}
              total={rows.length}
              busy={busy}
              onDrop={() => void persistOrder(rows)}
              onMove={(dir) => move(index, dir)}
              onDelete={() => setConfirmDelete(row)}
            />
          ))}
        </Reorder.Group>
      </section>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-line bg-surface">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-forest-text">Delete “{confirmDelete?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The collection page and its menu link are removed. The {confirmDelete?.productCount ?? 0} product{confirmDelete?.productCount === 1 ? "" : "s"} in it stay in your catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Keep it</AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-[#b91c1c] text-white hover:bg-[#991b1b]" onClick={() => confirmDelete && void remove(confirmDelete)}>
              Delete collection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CollectionItem({
  row,
  index,
  total,
  busy,
  onDrop,
  onMove,
  onDelete,
}: {
  row: Row;
  index: number;
  total: number;
  busy: boolean;
  onDrop: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  const controls = useDragControls();
  const core = PROTECTED.has(row.handle);

  return (
    <Reorder.Item
      value={row}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      whileDrag={{ scale: 1.01, boxShadow: "0 12px 32px -12px rgba(0,0,0,.35)", zIndex: 10 }}
      className="relative flex items-center gap-3 bg-surface px-3 py-3 sm:gap-4 sm:px-5"
    >
      <button
        type="button"
        onPointerDown={(e) => !busy && controls.start(e)}
        aria-label={`Drag to reorder ${row.title}`}
        className="hidden size-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-ink-muted transition-colors hover:bg-khaki-soft hover:text-forest-fg active:cursor-grabbing sm:grid"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-ink-muted">{index + 1}</span>

      <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-khaki-soft ring-1 ring-line">
        {row.imageUrl ? (
          <Image src={row.imageUrl} alt="" fill sizes="48px" className="object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-sm font-bold text-forest-fg">
            {row.title
              .split(/\s+/)
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
        )}
      </span>

      <Link href={`/admin/categories/${row.handle}`} className="group min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-semibold text-ink group-hover:text-forest-fg">{row.title}</span>
          {core && (
            <span title="Core collection: can't be deleted" className="text-ink-muted">
              <Lock className="size-3.5" />
            </span>
          )}
        </span>
        <span className="block truncate text-xs text-ink-muted">
          /collections/{row.handle} · <span className={cn(row.productCount === 0 && "font-semibold text-sale")}>{row.productCount} product{row.productCount === 1 ? "" : "s"}</span>
        </span>
      </Link>

      <div className="hidden items-center gap-1.5 md:flex">
        <Badge on={row.inMenu} icon={Menu} label="Menu" title={row.inMenu ? "Shown in the store menu" : "Not in the store menu"} />
        <Badge on={row.showHomepage} icon={Home} label="Homepage" title={row.showHomepage ? "Featured on the homepage" : "Not on the homepage"} />
      </div>

      <Link
        href={`/admin/categories/${row.handle}`}
        className="hidden h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-xs font-semibold text-forest-text transition-colors hover:border-forest/50 sm:inline-flex"
      >
        <Pencil className="size-3.5" /> Edit
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger aria-label={`More actions for ${row.title}`} className="grid size-9 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-khaki-soft hover:text-forest-fg">
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/admin/categories/${row.handle}`}>
              <Pencil /> Edit products & details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/collections/${row.handle}`} target="_blank">
              <ExternalLink /> View on store
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={busy || index === 0} onSelect={() => onMove(-1)}>
            <ArrowUp /> Move up
          </DropdownMenuItem>
          <DropdownMenuItem disabled={busy || index === total - 1} onSelect={() => onMove(1)}>
            <ArrowDown /> Move down
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={busy || core} onSelect={onDelete}>
            {core ? <Lock /> : <Trash2 />} {core ? "Core collection" : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Reorder.Item>
  );
}

function Badge({ on, icon: Icon, label, title }: { on: boolean; icon: typeof Menu; label: string; title: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold",
        on ? "bg-forest/10 text-forest-fg" : "border border-dashed border-line text-ink-muted/70",
      )}
    >
      {on ? <Check className="size-3" /> : <Icon className="size-3" />} {label}
    </span>
  );
}

function CreateCollection({ nextOrder, onCreated }: { nextOrder: number; onCreated: (row: Row) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [handle, setHandle] = useState("");
  const [touched, setTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const finalHandle = slug(handle || title);

  const reset = () => (setTitle(""), setHandle(""), setTouched(false), setDescription(""), setImageUrl(""), setError(""));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = unwrap(await saveCollectionAction({ handle: finalHandle, title, description, imageUrl, inMenu: false, menuOrder: nextOrder, showHomepage: false, products: [] }));
      onCreated({
        id: Date.now(),
        handle: result.handle,
        title,
        description,
        imageUrl,
        seoTitle: "",
        seoDescription: "",
        inMenu: false,
        menuOrder: nextOrder,
        showHomepage: false,
        sortOrder: nextOrder,
        active: true,
        productCount: 0,
      });
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create collection");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), o || reset())}>
      <DialogTrigger className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest px-5 text-sm font-semibold text-white transition-colors hover:bg-forest-mid">
        <Plus className="size-4" /> New collection
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl border-line bg-surface sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-forest-text">New collection</DialogTitle>
          <DialogDescription>It starts hidden from the menu. Add products and turn on the menu link from Edit.</DialogDescription>
        </DialogHeader>
        <form onSubmit={create} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold text-forest-text">Name</span>
            <input
              className={input}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!touched) setHandle(slug(e.target.value));
              }}
              required
              minLength={3}
              maxLength={160}
              placeholder="Festive Gift Packs"
              autoFocus
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold text-forest-text">URL handle</span>
            <div className="flex h-10 items-center overflow-hidden rounded-xl border border-line bg-surface focus-within:border-forest focus-within:ring-2 focus-within:ring-forest/15">
              <span className="border-r border-line bg-subtle px-2.5 text-xs leading-10 text-ink-muted">/collections/</span>
              <input
                className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm text-ink outline-none"
                value={handle}
                onChange={(e) => (setTouched(true), setHandle(slug(e.target.value)))}
                required
                maxLength={80}
                placeholder="festive-gift-packs"
              />
            </div>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold text-forest-text">Description</span>
            <textarea
              className={cn(input, "h-auto py-2.5 leading-relaxed")}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              placeholder="Shown at the top of the collection page."
            />
          </label>
          <div className="text-sm">
            <span className="mb-1.5 block font-semibold text-forest-text">Image</span>
            {imageUrl ? (
              <div className="relative overflow-hidden rounded-xl ring-1 ring-line">
                <Image src={imageUrl} alt="Collection preview" width={1200} height={675} className="h-36 w-full object-cover" />
                <button type="button" onClick={() => setImageUrl("")} aria-label="Remove image" className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-surface/90 text-red-700">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <DropZone folder="collections" multiple={false} label="Upload collection image" hint="Wide images work best" compact onUploaded={(images) => setImageUrl(images[0]?.url ?? "")} />
            )}
          </div>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-full px-4 text-sm font-semibold text-ink-muted hover:bg-khaki-soft">
              Cancel
            </button>
            <button disabled={busy || title.trim().length < 3 || !finalHandle} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest px-5 text-sm font-semibold text-white transition-colors hover:bg-forest-mid disabled:opacity-50">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create collection
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon: Icon, label, value, note, tone }: { icon: typeof Menu; label: string; value: number; note: string; tone?: "warn" }) {
  return (
    <div className={cn(card, "flex items-center gap-3 p-4", tone === "warn" && "border-warm-line")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone === "warn" ? "bg-warm-strong text-sale" : "bg-khaki-soft text-forest-fg")}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="text-xl font-bold tracking-tight text-forest-text">{value}</p>
        <p className="truncate text-[11px] text-ink-muted">{note}</p>
      </div>
    </div>
  );
}
