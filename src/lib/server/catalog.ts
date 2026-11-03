import "server-only";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Product, ProductCategory, ProductVariant } from "@/lib/commerce/types";
import { db } from "./db";

/**
 * Catalog in MySQL (products, product_variants, product_images, collections, collection_products).
 * Reads are a fixed number of queries regardless of catalog size (no N+1).
 */

type Rows = RowDataPacket[];
export type ProductStatus = "active" | "draft" | "archived";

const json = <T>(v: unknown, fallback: T): T => {
  if (v === null || v === undefined) return fallback;
  if (typeof v !== "string") return v as T;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
};

const inr = (amount: number) => ({ amount, currencyCode: "INR" as const });

function toVariant(v: RowDataPacket): ProductVariant & { stock: number | null; weightGrams: number | null; enabled: boolean } {
  const price = Number(v.price);
  const stock = v.stock_qty === null ? null : Number(v.stock_qty);
  return {
    id: v.variant_key,
    title: v.title,
    sizeValue: Number(v.size_value),
    sizeUnit: v.size_unit,
    price: inr(price),
    compareAtPrice: v.compare_at_price ? inr(Number(v.compare_at_price)) : undefined,
    availableForSale: !!v.available && price > 0 && (stock === null || stock > 0),
    sku: v.sku ?? undefined,
    stock,
    weightGrams: v.weight_grams === null ? null : Number(v.weight_grams),
    enabled: !!v.available,
  };
}

export type CatalogVariant = ProductVariant & { stock: number | null; weightGrams: number | null; enabled: boolean };
export type CatalogProduct = Omit<Product, "variants"> & {
  status: ProductStatus;
  collections: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  variants: CatalogVariant[];
};

/** Load products (optionally filtered) with variants, images and collection handles in 4 queries. */
export async function loadProducts(opts: { status?: ProductStatus | "any"; handles?: string[] } = {}): Promise<CatalogProduct[]> {
  const where: string[] = [];
  const params: (string | string[])[] = [];
  if (opts.status && opts.status !== "any") {
    where.push("p.status = ?");
    params.push(opts.status);
  }
  if (opts.handles) {
    if (!opts.handles.length) return [];
    where.push("p.handle IN (?)");
    params.push(opts.handles);
  }
  const [ps] = await db().query<Rows>(
    `SELECT p.* FROM products p ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY p.sort_order, p.id`,
    params,
  );
  if (!ps.length) return [];
  const ids = ps.map((p) => p.id);
  const handles = ps.map((p) => p.handle);
  const [[vs], [imgs], [cols], [revs]] = await Promise.all([
    db().query<Rows>("SELECT * FROM product_variants WHERE product_id IN (?) ORDER BY sort_order, size_value", [ids]),
    db().query<Rows>(
      "SELECT product_handle, url, alt, width, height FROM product_images WHERE product_handle IN (?) ORDER BY sort_order, id",
      [handles],
    ),
    db().query<Rows>(
      "SELECT cp.product_id, c.handle FROM collection_products cp JOIN collections c ON c.id = cp.collection_id WHERE cp.product_id IN (?)",
      [ids],
    ),
    db().query<Rows>(
      "SELECT product_handle, AVG(rating) AS avg_rating, COUNT(*) AS n FROM reviews WHERE status = 'approved' AND product_handle IN (?) GROUP BY product_handle",
      [handles],
    ),
  ]);

  return ps.map((p) => {
    const rev = revs.find((r) => r.product_handle === p.handle);
    const variants = vs.filter((v) => v.product_id === p.id).map(toVariant);
    const priced = variants.filter((v) => v.availableForSale).map((v) => v.price.amount);
    const images = imgs
      .filter((i) => i.product_handle === p.handle)
      .map((i) => ({ url: i.url, alt: i.alt || p.title, width: i.width, height: i.height }));
    return {
      id: `gid://db/Product/${p.id}`,
      handle: p.handle,
      title: p.title,
      titleHi: p.title_hi ?? "",
      category: p.category as ProductCategory,
      swatch: p.swatch ?? undefined,
      shortDescription: p.short_description,
      descriptionHtml: p.description_html ?? "",
      benefits: json<string[]>(p.benefits, []),
      bestFor: json<string[]>(p.best_for, []),
      howToUse: p.how_to_use ?? undefined,
      processNote: p.process_note ?? undefined,
      labReportUrl: p.lab_report_url ?? undefined,
      shelfLife: p.shelf_life ?? undefined,
      images: images.length
        ? images
        : [{ url: `/images/placeholder-${p.handle}.svg`, alt: `${p.title} bottle`, width: 800, height: 800 }],
      variants,
      priceRange: {
        min: inr(priced.length ? Math.min(...priced) : 0),
        max: inr(priced.length ? Math.max(...priced) : 0),
      },
      // Only real, approved reviews. No review = no stars.
      rating: rev ? Math.round(Number(rev.avg_rating) * 10) / 10 : undefined,
      reviewCount: rev ? Number(rev.n) : undefined,
      tags: json<string[]>(p.tags, []),
      faqs: json<{ q: string; a: string }[]>(p.faqs, []),
      seo: { title: p.seo_title || p.title, description: p.seo_description || p.short_description },
      status: p.status,
      collections: cols.filter((c) => c.product_id === p.id).map((c) => c.handle as string),
      sortOrder: p.sort_order,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  });
}

export async function loadCollections() {
  const [rows] = await db().query<Rows>("SELECT id, handle, title, description, image_url FROM collections WHERE active = 1 ORDER BY sort_order, id");
  return rows.map((r) => ({ id: r.id as number, handle: r.handle as string, title: r.title as string, description: (r.description ?? "") as string }));
}

export async function catalogIsEmpty() {
  const [[r]] = await db().query<Rows>("SELECT COUNT(*) AS n FROM products");
  return Number(r.n) === 0;
}

// ───────────── Admin writes ─────────────

export type ProductInput = {
  handle: string;
  title: string;
  titleHi: string;
  category: ProductCategory;
  swatch?: string;
  shortDescription: string;
  descriptionHtml: string;
  benefits: string[];
  bestFor: string[];
  howToUse?: string;
  processNote?: string;
  labReportUrl?: string;
  shelfLife?: string;
  tags: string[];
  faqs: { q: string; a: string }[];
  seoTitle?: string;
  seoDescription?: string;
  status: ProductStatus;
  collections: string[];
  variants: {
    key?: string;
    title: string;
    sizeValue: number;
    sizeUnit: "ml" | "g";
    price: number;
    compareAtPrice?: number;
    stock: number | null;
    available: boolean;
    sku?: string;
    weightGrams?: number;
  }[];
};

async function tx<T>(fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  const c = await db().getConnection();
  try {
    await c.beginTransaction();
    const out = await fn(c);
    await c.commit();
    return out;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

export const variantKey = (handle: string, title: string) =>
  `${handle}--${title.toLowerCase().replace(/\s+/g, "")}`.slice(0, 100);

/** Insert or update one product (by handle) with its variants and collections. */
export async function saveProduct(input: ProductInput, originalHandle?: string): Promise<string> {
  return tx(async (c) => {
    const [existing] = await c.execute<Rows>("SELECT id FROM products WHERE handle = ?", [originalHandle ?? input.handle]);
    const cols = [
      input.handle, input.title, input.titleHi || null, input.category, input.swatch || null, input.shortDescription,
      input.descriptionHtml || null, JSON.stringify(input.benefits), JSON.stringify(input.bestFor), input.howToUse || null,
      input.processNote || null, input.labReportUrl || null, input.shelfLife || null, JSON.stringify(input.tags),
      JSON.stringify(input.faqs), input.seoTitle || null, input.seoDescription || null, input.status,
    ];
    let id: number;
    if (existing[0]) {
      id = existing[0].id;
      await c.execute(
        `UPDATE products SET handle=?, title=?, title_hi=?, category=?, swatch=?, short_description=?, description_html=?, benefits=?,
           best_for=?, how_to_use=?, process_note=?, lab_report_url=?, shelf_life=?, tags=?, faqs=?, seo_title=?, seo_description=?, status=?
         WHERE id = ?`,
        [...cols, id],
      );
      if (originalHandle && originalHandle !== input.handle) {
        await c.execute("UPDATE product_images SET product_handle = ? WHERE product_handle = ?", [input.handle, originalHandle]);
      }
    } else {
      const [[{ next }]] = await c.query<Rows>("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM products");
      const [res] = await c.execute<ResultSetHeader>(
        `INSERT INTO products (handle, title, title_hi, category, swatch, short_description, description_html, benefits, best_for,
           how_to_use, process_note, lab_report_url, shelf_life, tags, faqs, seo_title, seo_description, status, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [...cols, Number(next)],
      );
      id = res.insertId;
    }

    // Variants: update by key, insert new, delete the ones removed in the form.
    const keep: string[] = [];
    for (const [i, v] of input.variants.entries()) {
      const key = v.key || variantKey(input.handle, v.title);
      keep.push(key);
      await c.execute(
        `INSERT INTO product_variants (product_id, variant_key, title, size_value, size_unit, sku, price, compare_at_price, stock_qty, available, weight_grams, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE product_id=VALUES(product_id), title=VALUES(title), size_value=VALUES(size_value), size_unit=VALUES(size_unit),
           sku=VALUES(sku), price=VALUES(price), compare_at_price=VALUES(compare_at_price), stock_qty=VALUES(stock_qty),
           available=VALUES(available), weight_grams=VALUES(weight_grams), sort_order=VALUES(sort_order)`,
        [id, key, v.title, v.sizeValue, v.sizeUnit, v.sku || null, v.price, v.compareAtPrice || null, v.stock, v.available ? 1 : 0,
         v.weightGrams || null, i],
      );
    }
    await c.query(
      keep.length ? "DELETE FROM product_variants WHERE product_id = ? AND variant_key NOT IN (?)" : "DELETE FROM product_variants WHERE product_id = ?",
      keep.length ? [id, keep] : [id],
    );

    await c.execute("DELETE FROM collection_products WHERE product_id = ?", [id]);
    if (input.collections.length) {
      await c.query(
        "INSERT INTO collection_products (collection_id, product_id) SELECT id, ? FROM collections WHERE handle IN (?)",
        [id, input.collections],
      );
    }
    return input.handle;
  });
}

export type BulkAction =
  | { type: "status"; status: ProductStatus }
  | { type: "delete" }
  | { type: "addToCollection"; collection: string }
  | { type: "removeFromCollection"; collection: string };

export async function bulkUpdate(handles: string[], action: BulkAction): Promise<number> {
  if (!handles.length) return 0;
  switch (action.type) {
    case "status": {
      const [r] = await db().query<ResultSetHeader>("UPDATE products SET status = ? WHERE handle IN (?)", [action.status, handles]);
      return r.affectedRows;
    }
    case "delete": {
      // Order history keeps its own snapshot of titles/prices, so deleting is safe.
      await db().query("DELETE FROM product_images WHERE product_handle IN (?)", [handles]);
      const [r] = await db().query<ResultSetHeader>("DELETE FROM products WHERE handle IN (?)", [handles]);
      return r.affectedRows;
    }
    case "addToCollection": {
      const [r] = await db().query<ResultSetHeader>(
        `INSERT IGNORE INTO collection_products (collection_id, product_id)
         SELECT c.id, p.id FROM collections c JOIN products p ON p.handle IN (?) WHERE c.handle = ?`,
        [handles, action.collection],
      );
      return r.affectedRows;
    }
    case "removeFromCollection": {
      const [r] = await db().query<ResultSetHeader>(
        `DELETE cp FROM collection_products cp JOIN collections c ON c.id = cp.collection_id JOIN products p ON p.id = cp.product_id
         WHERE c.handle = ? AND p.handle IN (?)`,
        [action.collection, handles],
      );
      return r.affectedRows;
    }
  }
}

export async function reorderProducts(handles: string[]) {
  if (!handles.length) return;
  await db().query(
    `UPDATE products SET sort_order = CASE handle ${handles.map(() => "WHEN ? THEN ?").join(" ")} END WHERE handle IN (?)`,
    [...handles.flatMap((h, i) => [h, i]), handles],
  );
}

/** First-run import of the starter catalog (src/data) into an empty database. */
export async function importStarterCatalog(
  products: Product[],
  collections: { handle: string; title: string; description: string; match: (p: Product) => boolean }[],
) {
  await tx(async (c) => {
    for (const [i, col] of collections.entries()) {
      await c.execute(
        `INSERT INTO collections (handle, title, description, sort_order) VALUES (?,?,?,?)
         ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description)`,
        [col.handle, col.title, col.description, i],
      );
    }
  });
  for (const [i, p] of products.entries()) {
    await saveProduct({
      handle: p.handle,
      title: p.title,
      titleHi: p.titleHi,
      category: p.category,
      swatch: p.swatch,
      shortDescription: p.shortDescription,
      descriptionHtml: p.descriptionHtml,
      benefits: p.benefits,
      bestFor: p.bestFor,
      howToUse: p.howToUse,
      processNote: p.processNote,
      labReportUrl: p.labReportUrl,
      shelfLife: p.shelfLife,
      tags: p.tags,
      faqs: p.faqs ?? [],
      seoTitle: p.seo.title,
      seoDescription: p.seo.description,
      status: "active",
      collections: collections.filter((c) => c.match(p)).map((c) => c.handle),
      variants: p.variants.map((v) => ({
        key: v.id,
        title: v.title,
        sizeValue: v.sizeValue,
        sizeUnit: v.sizeUnit,
        price: v.price.amount,
        compareAtPrice: v.compareAtPrice?.amount,
        stock: null,
        available: v.availableForSale,
        sku: v.sku,
      })),
    });
    await db().execute("UPDATE products SET sort_order = ? WHERE handle = ?", [i, p.handle]);
  }
}

/** Find variants by key (cart). One query. */
export async function findVariants(keys: string[]) {
  if (!keys.length) return [];
  const [rows] = await db().query<Rows>(
    `SELECT v.*, p.handle, p.title AS product_title, p.status FROM product_variants v JOIN products p ON p.id = v.product_id
     WHERE v.variant_key IN (?)`,
    [keys],
  );
  return rows.map((r) => ({ handle: r.handle as string, productTitle: r.product_title as string, status: r.status as ProductStatus, variant: toVariant(r) }));
}
