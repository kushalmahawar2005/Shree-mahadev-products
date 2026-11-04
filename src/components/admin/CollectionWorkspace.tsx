"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { Card, Field, PageHeader, StatusBadge, inputCls } from "@/components/admin/ui";
import { DropZone } from "@/components/admin/media/DropZone";
import { deleteCollectionAction, reorderCollectionsAction, saveCollectionAction } from "@/lib/collection-actions";

type Row = { id: number; handle: string; title: string; description: string; imageUrl: string; seoTitle: string; seoDescription: string; inMenu: boolean; menuOrder: number; showHomepage: boolean; sortOrder: number; active: boolean; productCount: number };
const protectedHandles = new Set(["wood-pressed-oils", "raw-honey", "natural-sweeteners", "bestsellers"]);
const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function CollectionWorkspace({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dragged, setDragged] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [handle, setHandle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const ordered = useMemo(() => [...rows].sort((a, b) => a.sortOrder - b.sortOrder), [rows]);
  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const result = await saveCollectionAction({ handle: slug(handle || title), title, description, imageUrl, inMenu: false, menuOrder: rows.length, showHomepage: false, products: [] });
      setRows((current) => [...current, { id: Date.now(), handle: result.handle, title, description, imageUrl, seoTitle: "", seoDescription: "", inMenu: false, menuOrder: rows.length, showHomepage: false, sortOrder: rows.length, active: true, productCount: 0 }]);
      setTitle(""); setHandle(""); setDescription(""); setImageUrl(""); setMessage("Collection created.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create collection"); }
    finally { setBusy(false); }
  };

  const saveOrder = async (next: Row[]) => {
    setRows(next.map((r, i) => ({ ...r, sortOrder: i })));
    setBusy(true); setError(""); setMessage("");
    try { await reorderCollectionsAction(next.map((r) => r.handle)); setMessage("Collection order saved."); }
    catch (e) { setRows(initialRows); setError(e instanceof Error ? e.message : "Could not save order"); }
    finally { setBusy(false); }
  };

  const move = (index: number, offset: number) => {
    const target = index + offset; if (target < 0 || target >= ordered.length) return;
    const next = [...ordered]; [next[index], next[target]] = [next[target], next[index]]; void saveOrder(next);
  };

  const remove = async (row: Row) => {
    if (protectedHandles.has(row.handle)) return;
    if (!window.confirm(`Delete “${row.title}” and remove its product links?`)) return;
    setBusy(true); setError(""); setMessage("");
    try { await deleteCollectionAction(row.handle); setRows((current) => current.filter((r) => r.handle !== row.handle)); setMessage("Collection deleted."); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not delete collection"); }
    finally { setBusy(false); }
  };

  return <>
    <PageHeader title="Collections" intro="Manage collection pages, menu visibility, homepage sections, and product order." />
    <Card title={`Saved collections (${rows.length})`}>
      <p className="mb-4 text-sm text-ink-muted">Drag rows to set the storefront order, or use the arrow buttons on touch screens. Core collections stay protected from deletion.</p>
      {(error || message) && <p role={error ? "alert" : "status"} className={`mb-4 rounded-xl px-4 py-3 text-sm ${error ? "bg-sale/10 text-sale" : "bg-forest/10 text-forest"}`}>{error || message}</p>}
      <ol className="space-y-2">
        {ordered.map((row, index) => <li key={row.handle} draggable={!busy} onDragStart={() => setDragged(row.handle)} onDragOver={(e) => e.preventDefault()} onDrop={() => {
          if (!dragged || dragged === row.handle) return;
          const next = [...ordered]; const from = next.findIndex((r) => r.handle === dragged); const [item] = next.splice(from, 1); next.splice(index, 0, item); setDragged(null); void saveOrder(next);
        }} className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-line bg-white p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:p-4">
          <span className="grid size-10 place-items-center rounded-full bg-khaki-soft text-lg text-forest" aria-hidden>⠿</span>
          <div className="min-w-0"><p className="truncate font-semibold text-forest-text">{row.title}</p><p className="truncate text-sm text-ink-muted">/collections/{row.handle} · {row.productCount} products</p></div>
          <div className="flex items-center gap-2 sm:order-last">
            <StatusBadge tone={row.inMenu ? "green" : "gray"}>{row.inMenu ? "In menu" : "Hidden"}</StatusBadge>
            <button type="button" onClick={() => void remove(row)} disabled={busy || protectedHandles.has(row.handle)} title={protectedHandles.has(row.handle) ? "Core collection" : "Delete collection"} aria-label={`Delete ${row.title}`} className="grid size-11 place-items-center rounded-full border border-line text-sale disabled:cursor-not-allowed disabled:opacity-35">×</button>
          </div>
          <div className="flex items-center gap-2 sm:col-start-3 sm:row-start-1">
            <button type="button" onClick={() => move(index, -1)} disabled={busy || index === 0} aria-label={`Move ${row.title} up`} className="grid size-11 place-items-center rounded-full border border-line text-forest disabled:opacity-40">↑</button>
            <button type="button" onClick={() => move(index, 1)} disabled={busy || index === ordered.length - 1} aria-label={`Move ${row.title} down`} className="grid size-11 place-items-center rounded-full border border-line text-forest disabled:opacity-40">↓</button>
            <Link href={`/admin/categories/${row.handle}`} className="inline-flex min-h-11 items-center rounded-full bg-forest px-4 text-sm font-semibold text-white">Edit</Link>
          </div>
        </li>)}
      </ol>
    </Card>

    <Card title="Create a collection" className="mt-6">
      <form onSubmit={create} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Collection name"><input className={inputCls} value={title} onChange={(e) => { setTitle(e.target.value); if (!handle) setHandle(slug(e.target.value)); }} required minLength={3} maxLength={160} /></Field>
          <Field label="URL handle"><input className={inputCls} value={handle} onChange={(e) => setHandle(slug(e.target.value))} required maxLength={80} /><span className="text-xs text-ink-muted">/collections/{slug(handle || title) || "your-collection"}</span></Field>
          <div className="sm:col-span-2"><Field label="Description"><textarea className={`${inputCls} py-3`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} /></Field></div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)] lg:items-start">
          <div><Field label="Collection image URL"><input className={inputCls} type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Upload below to add a Cloudinary image" /></Field>{imageUrl && <Image src={imageUrl} alt="Collection preview" width={1200} height={675} unoptimized className="mt-3 h-36 w-full rounded-xl object-cover" />}</div>
          <DropZone folder="collections" multiple={false} label="Upload collection image" hint="Cloudinary · images only" compact onUploaded={(images) => setImageUrl(images[0]?.url ?? "")} />
        </div>
        <button disabled={busy || !title.trim()} className="min-h-12 rounded-full bg-forest px-6 font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Create collection"}</button>
      </form>
    </Card>
  </>;
}
