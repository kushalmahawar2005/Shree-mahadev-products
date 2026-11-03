import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { Product } from "@/lib/commerce/types";
import { db } from "./db";

export type ProductImage = { id: number; publicId: string; url: string; alt: string; width: number; height: number };

// ───────────── Product images ─────────────

export async function getProductImages(handle: string): Promise<ProductImage[]> {
  const [rows] = await db().execute<RowDataPacket[]>(
    "SELECT id, public_id, url, alt, width, height FROM product_images WHERE product_handle = ? ORDER BY sort_order, id",
    [handle],
  );
  return rows.map((r) => ({ id: r.id, publicId: r.public_id, url: r.url, alt: r.alt, width: r.width, height: r.height }));
}

/** One query for many products (no N+1). */
async function imagesByHandle(handles: string[]) {
  const map = new Map<string, Product["images"]>();
  if (!handles.length) return map;
  const [rows] = await db().query<RowDataPacket[]>(
    "SELECT product_handle, url, alt, width, height FROM product_images WHERE product_handle IN (?) ORDER BY sort_order, id",
    [handles],
  );
  for (const r of rows) {
    const list = map.get(r.product_handle) ?? [];
    list.push({ url: r.url, alt: r.alt, width: r.width, height: r.height });
    map.set(r.product_handle, list);
  }
  return map;
}

/** Replace placeholder images with uploaded ones. Falls back silently if the DB is unreachable. */
export async function withDbImages<T extends Pick<Product, "handle" | "images" | "title">>(products: T[]): Promise<T[]> {
  if (!process.env.DATABASE_NAME || !products.length) return products;
  try {
    const map = await imagesByHandle([...new Set(products.map((p) => p.handle))]);
    return products.map((p) => {
      const imgs = map.get(p.handle);
      return imgs?.length ? { ...p, images: imgs.map((i) => ({ ...i, alt: i.alt || p.title })) } : p;
    });
  } catch (e) {
    console.error("withDbImages failed", e);
    return products;
  }
}

export async function addProductImages(handle: string, imgs: Omit<ProductImage, "id">[]) {
  if (!imgs.length) return;
  const [[{ next }]] = await db().query<RowDataPacket[]>(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM product_images WHERE product_handle = ?",
    [handle],
  );
  await db().query(
    "INSERT INTO product_images (product_handle, public_id, url, alt, width, height, sort_order) VALUES ?",
    [imgs.map((i, n) => [handle, i.publicId, i.url, i.alt, i.width, i.height, Number(next) + n])],
  );
}

export async function reorderProductImages(handle: string, ids: number[]) {
  if (!ids.length) return;
  // Single UPDATE with CASE instead of one query per image.
  await db().query(
    `UPDATE product_images SET sort_order = CASE id ${ids.map(() => "WHEN ? THEN ?").join(" ")} END
     WHERE product_handle = ? AND id IN (?)`,
    [...ids.flatMap((id, i) => [id, i]), handle, ids],
  );
}

export async function updateProductImageAlt(id: number, alt: string) {
  await db().execute("UPDATE product_images SET alt = ? WHERE id = ?", [alt.slice(0, 255), id]);
}

export async function deleteProductImage(id: number): Promise<{ handle: string; publicId: string } | null> {
  const [rows] = await db().execute<RowDataPacket[]>("SELECT product_handle, public_id FROM product_images WHERE id = ?", [id]);
  if (!rows[0]) return null;
  await db().execute("DELETE FROM product_images WHERE id = ?", [id]);
  return { handle: rows[0].product_handle, publicId: rows[0].public_id };
}

// ───────────── Hero banners ─────────────

export type Banner = {
  id: number;
  alt: string;
  href: string;
  desktop: { url: string; publicId: string } | null;
  mobile: { url: string; publicId: string } | null;
  active: boolean;
};

export async function listBanners(onlyActive = false): Promise<Banner[]> {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT id, title, link_url, image_desktop, image_mobile, desktop_public_id, mobile_public_id, active
     FROM banners WHERE placement = 'hero' ${onlyActive ? "AND active = 1 AND image_desktop IS NOT NULL AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at > NOW())" : ""}
     ORDER BY sort_order, id`,
  );
  return rows.map((r) => ({
    id: r.id,
    alt: r.title,
    href: r.link_url ?? "/shop",
    desktop: r.image_desktop ? { url: r.image_desktop, publicId: r.desktop_public_id } : null,
    mobile: r.image_mobile ? { url: r.image_mobile, publicId: r.mobile_public_id } : null,
    active: !!r.active,
  }));
}

export async function createBanner(desktop: { url: string; publicId: string }): Promise<number> {
  const [res] = await db().execute<ResultSetHeader>(
    `INSERT INTO banners (placement, title, link_url, image_desktop, desktop_public_id, sort_order, active)
     SELECT 'hero', '', '/shop', ?, ?, COALESCE(MAX(sort_order), -1) + 1, 1 FROM banners WHERE placement = 'hero'`,
    [desktop.url, desktop.publicId],
  );
  return res.insertId;
}

export async function updateBanner(
  id: number,
  patch: { alt?: string; href?: string; active?: boolean; mobile?: { url: string; publicId: string } | null; desktop?: { url: string; publicId: string } },
): Promise<string[]> {
  const [rows] = await db().execute<RowDataPacket[]>("SELECT desktop_public_id, mobile_public_id FROM banners WHERE id = ?", [id]);
  if (!rows[0]) return [];
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  const orphaned: string[] = [];
  if (patch.alt !== undefined) {
    sets.push("title = ?");
    vals.push(patch.alt.slice(0, 160));
  }
  if (patch.href !== undefined) {
    sets.push("link_url = ?");
    vals.push(patch.href.slice(0, 500));
  }
  if (patch.active !== undefined) {
    sets.push("active = ?");
    vals.push(patch.active ? 1 : 0);
  }
  if (patch.desktop) {
    sets.push("image_desktop = ?", "desktop_public_id = ?");
    vals.push(patch.desktop.url, patch.desktop.publicId);
    if (rows[0].desktop_public_id) orphaned.push(rows[0].desktop_public_id);
  }
  if (patch.mobile !== undefined) {
    sets.push("image_mobile = ?", "mobile_public_id = ?");
    vals.push(patch.mobile?.url ?? null, patch.mobile?.publicId ?? null);
    if (rows[0].mobile_public_id) orphaned.push(rows[0].mobile_public_id);
  }
  if (sets.length) await db().execute(`UPDATE banners SET ${sets.join(", ")} WHERE id = ?`, [...vals, id]);
  return orphaned;
}

export async function reorderBanners(ids: number[]) {
  if (!ids.length) return;
  await db().query(
    `UPDATE banners SET sort_order = CASE id ${ids.map(() => "WHEN ? THEN ?").join(" ")} END WHERE placement = 'hero' AND id IN (?)`,
    [...ids.flatMap((id, i) => [id, i]), ids],
  );
}

export async function deleteBanner(id: number): Promise<string[]> {
  const [rows] = await db().execute<RowDataPacket[]>("SELECT desktop_public_id, mobile_public_id FROM banners WHERE id = ?", [id]);
  if (!rows[0]) return [];
  await db().execute("DELETE FROM banners WHERE id = ?", [id]);
  return [rows[0].desktop_public_id, rows[0].mobile_public_id].filter(Boolean);
}
