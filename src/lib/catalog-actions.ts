"use server";

import { safe, type ActionResult } from "@/lib/action-result";
import { updateTag } from "next/cache";
import { collectionDefs } from "@/data/collections";
import { products as starterProducts } from "@/data/products";
import { TAGS } from "@/lib/commerce";
import { requireAdmin } from "@/lib/server/admin-auth";
import {
  bulkUpdate,
  catalogIsEmpty,
  importStarterCatalog,
  saveProduct,
  variantKey,
  type BulkAction,
  type ProductInput,
} from "@/lib/server/catalog";

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CATS = ["oil", "honey", "sweetener"] as const;
const STATUSES = ["active", "draft", "archived"] as const;

function bust(handles: string[] = []) {
  updateTag(TAGS.products);
  updateTag(TAGS.collections);
  for (const h of handles) updateTag(TAGS.product(h));
}

const clean = (s: unknown, max: number) => String(s ?? "").trim().slice(0, max);
const lines = (a: unknown, max = 12) =>
  (Array.isArray(a) ? a : []).map((x) => clean(x, 200)).filter(Boolean).slice(0, max);

/** Validate everything the browser sends; never trust the form. */
function validate(raw: ProductInput): ProductInput {
  const handle = clean(raw.handle, 80).toLowerCase();
  if (!HANDLE.test(handle)) throw new Error("URL handle can only have lowercase letters, numbers and dashes");
  const title = clean(raw.title, 160);
  if (title.length < 3) throw new Error("Title is too short");
  if (!CATS.includes(raw.category)) throw new Error("Pick a category");
  if (!STATUSES.includes(raw.status)) throw new Error("Pick a status");
  if (raw.swatch && !/^#[0-9a-fA-F]{6}$/.test(raw.swatch)) throw new Error("Colour must look like #D9B45A");
  const hsn = clean(raw.hsn, 10);
  if (hsn && !/^\d{1,10}$/.test(hsn)) throw new Error("HSN must contain up to 10 digits");
  const gstRate = raw.gstRate === undefined || raw.gstRate === null || String(raw.gstRate).trim() === "" ? undefined : Number(raw.gstRate);
  if (gstRate !== undefined && (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100)) throw new Error("GST rate must be between 0 and 100");
  const variants = (Array.isArray(raw.variants) ? raw.variants : []).slice(0, 20).map((v, i) => {
    const t = clean(v.title, 40);
    if (!t) throw new Error(`Variant ${i + 1}: size name is required (e.g. "1 L")`);
    const price = Math.round(Number(v.price));
    const mrp = v.compareAtPrice ? Math.round(Number(v.compareAtPrice)) : undefined;
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) throw new Error(`${t}: invalid price`);
    if (mrp !== undefined && (!Number.isFinite(mrp) || mrp < price)) throw new Error(`${t}: MRP must be at least the price`);
    const sizeValue = Math.round(Number(v.sizeValue));
    if (!Number.isFinite(sizeValue) || sizeValue <= 0) throw new Error(`${t}: size value must be a number like 1000`);
    const stock = v.stock === null || v.stock === undefined || String(v.stock) === "" ? null : Math.round(Number(v.stock));
    if (stock !== null && (!Number.isFinite(stock) || stock < 0)) throw new Error(`${t}: stock must be 0 or more (or empty)`);
    const weight = v.weightGrams ? Math.round(Number(v.weightGrams)) : undefined;
    return {
      key: v.key ? clean(v.key, 100) : undefined,
      title: t,
      sizeValue,
      sizeUnit: v.sizeUnit === "g" ? ("g" as const) : ("ml" as const),
      price,
      compareAtPrice: mrp,
      stock,
      available: !!v.available && price > 0,
      sku: clean(v.sku, 60) || undefined,
      weightGrams: weight && weight > 0 ? weight : undefined,
    };
  });
  if (!variants.length) throw new Error("Add at least one size");
  const titles = variants.map((v) => v.title.toLowerCase());
  if (new Set(titles).size !== titles.length) throw new Error("Two sizes have the same name");
  const keys = variants.map((v) => v.key || variantKey(handle, v.title));
  if (new Set(keys).size !== keys.length) throw new Error("Two sizes produce the same variant key; use distinct size names");
  const skus = variants.map((v) => v.sku?.toLowerCase()).filter(Boolean);
  if (new Set(skus).size !== skus.length) throw new Error("Each size must have a different SKU");
  return {
    handle,
    title,
    titleHi: clean(raw.titleHi, 160),
    category: raw.category,
    swatch: raw.swatch || undefined,
    shortDescription: clean(raw.shortDescription, 255),
    descriptionHtml: clean(raw.descriptionHtml, 20_000),
    benefits: lines(raw.benefits),
    bestFor: lines(raw.bestFor),
    howToUse: clean(raw.howToUse, 2000) || undefined,
    processNote: clean(raw.processNote, 2000) || undefined,
    labReportUrl: clean(raw.labReportUrl, 500) || undefined,
    shelfLife: clean(raw.shelfLife, 255) || undefined,
    tags: lines(raw.tags, 30).map((t) => t.toLowerCase()),
    faqs: (Array.isArray(raw.faqs) ? raw.faqs : [])
      .map((f) => ({ q: clean(f?.q, 300), a: clean(f?.a, 2000) }))
      .filter((f) => f.q && f.a)
      .slice(0, 20),
    seoTitle: clean(raw.seoTitle, 160) || undefined,
    seoDescription: clean(raw.seoDescription, 320) || undefined,
    hsn: hsn || undefined,
    gstRate,
    status: raw.status,
    collections: lines(raw.collections, 30).filter((c) => HANDLE.test(c)),
    variants,
    // Only keep a default that still matches one of the sizes.
    defaultSize: variants.find((v) => v.title.toLowerCase() === clean(raw.defaultSize, 40).toLowerCase())?.title,
  };
}

export async function saveProductAction(raw: ProductInput, originalHandle?: string): Promise<ActionResult<{ handle: string }>> {
  return safe(async () => {
    await requireAdmin();
    const input = validate(raw);
    try {
      const handle = await saveProduct(input, originalHandle);
      bust([handle, ...(originalHandle && originalHandle !== handle ? [originalHandle] : [])]);
      return { handle };
    } catch (e) {
      if ((e as { code?: string }).code === "ER_DUP_ENTRY") throw new Error("That URL handle or SKU is already used by another product");
      throw e;
    }
  });
}

export async function bulkProductsAction(handles: string[], action: BulkAction): Promise<ActionResult<number>> {
  return safe(async () => {
    await requireAdmin();
    if (!Array.isArray(handles) || handles.length > 500 || !handles.every((h) => HANDLE.test(h))) throw new Error("Invalid selection");
    const ok =
      (action?.type === "status" && STATUSES.includes(action.status)) ||
      action?.type === "delete" ||
      ((action?.type === "addToCollection" || action?.type === "removeFromCollection") && HANDLE.test(action.collection));
    if (!ok) throw new Error("Invalid action");
    const n = await bulkUpdate(handles, action);
    bust(handles);
    return n;
  });
}

export async function importStarterCatalogAction(): Promise<ActionResult<number>> {
  return safe(async () => {
    await requireAdmin();
    if (!(await catalogIsEmpty())) throw new Error("The catalog already has products");
    await importStarterCatalog(starterProducts, collectionDefs);
    bust(starterProducts.map((p) => p.handle));
    return starterProducts.length;
  });
}
