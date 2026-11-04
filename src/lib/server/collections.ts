import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { db } from "@/lib/server/db";

const CORE = new Set(["wood-pressed-oils", "raw-honey", "natural-sweeteners", "bestsellers"]);

export type CollectionInput = {
  handle: string;
  title: string;
  description: string;
  imageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  inMenu: boolean;
  menuOrder: number;
  showHomepage: boolean;
  products: string[];
};

export async function listAdminCollections() {
  const [rows] = await db().query<RowDataPacket[]>(
    `SELECT c.id, c.handle, c.title, c.description, c.image_url AS imageUrl, c.seo_title AS seoTitle,
            c.seo_description AS seoDescription, c.in_menu AS inMenu, c.menu_order AS menuOrder,
            c.show_homepage AS showHomepage, c.sort_order AS sortOrder, c.active,
            COUNT(cp.product_id) AS productCount
     FROM collections c LEFT JOIN collection_products cp ON cp.collection_id = c.id
     GROUP BY c.id ORDER BY c.sort_order, c.id`,
  );
  return rows.map((r) => ({
    id: Number(r.id), handle: String(r.handle), title: String(r.title), description: String(r.description ?? ""),
    imageUrl: (r.imageUrl ?? "") as string, seoTitle: String(r.seoTitle ?? ""), seoDescription: String(r.seoDescription ?? ""),
    inMenu: !!r.inMenu, menuOrder: Number(r.menuOrder), showHomepage: !!r.showHomepage, sortOrder: Number(r.sortOrder),
    active: !!r.active, productCount: Number(r.productCount),
  }));
}

export async function saveCollection(input: CollectionInput, originalHandle?: string) {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = originalHandle
      ? await conn.query<RowDataPacket[]>("SELECT id, handle, sort_order FROM collections WHERE handle = ? FOR UPDATE", [originalHandle])
      : [[] as RowDataPacket[]];
    if (originalHandle && !existing.length) throw new Error("Collection not found");
    let id: number;
    let sortOrder: number;
    if (existing.length) {
      id = Number(existing[0].id);
      sortOrder = Number(existing[0].sort_order);
      await conn.execute(
        `UPDATE collections SET handle=?, title=?, description=?, image_url=?, seo_title=?, seo_description=?,
         in_menu=?, menu_order=?, show_homepage=?, active=1 WHERE id=?`,
        [input.handle, input.title, input.description || null, input.imageUrl || null, input.seoTitle || null,
          input.seoDescription || null, input.inMenu ? 1 : 0, input.menuOrder, input.showHomepage ? 1 : 0, id],
      );
      if (originalHandle !== input.handle) {
        await conn.execute("UPDATE redirects SET destination_path=? WHERE destination_path=?", [`/collections/${input.handle}`, `/collections/${originalHandle}`]);
        await conn.execute("DELETE FROM redirects WHERE source_path=?", [`/collections/${input.handle}`]);
        await conn.execute(
          `INSERT INTO redirects (source_path, destination_path) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE destination_path=VALUES(destination_path)`,
          [`/collections/${originalHandle}`, `/collections/${input.handle}`],
        );
      }
    } else {
      const [[max]] = await conn.query<RowDataPacket[]>("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM collections");
      sortOrder = Number(max.next_order);
      const [result] = await conn.execute<ResultSetHeader>(
        `INSERT INTO collections (handle,title,description,image_url,seo_title,seo_description,in_menu,menu_order,show_homepage,sort_order,active)
         VALUES (?,?,?,?,?,?,?,?,?,?,1)`,
        [input.handle, input.title, input.description || null, input.imageUrl || null, input.seoTitle || null,
          input.seoDescription || null, input.inMenu ? 1 : 0, input.menuOrder, input.showHomepage ? 1 : 0, sortOrder],
      );
      id = result.insertId;
    }
    const [products] = input.products.length
      ? await conn.query<RowDataPacket[]>("SELECT id, handle FROM products WHERE handle IN (?) ORDER BY sort_order, id", [input.products])
      : [[] as RowDataPacket[]];
    if (products.length !== input.products.length) throw new Error("One or more selected products no longer exist");
    await conn.execute("DELETE FROM collection_products WHERE collection_id=?", [id]);
    const productIds = new Map(products.map((product) => [String(product.handle), Number(product.id)]));
    for (const [i, handle] of input.products.entries()) {
      const productId = productIds.get(handle);
      if (!productId) throw new Error("One or more selected products no longer exist");
      await conn.execute("INSERT INTO collection_products (collection_id,product_id,sort_order) VALUES (?,?,?)", [id, productId, i]);
    }
    await conn.commit();
    return { handle: input.handle, previousHandle: originalHandle, sortOrder };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function saveCollectionOrder(handles: string[]) {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id, handle FROM collections WHERE active=1 FOR UPDATE");
    if (rows.length !== handles.length || rows.some((r) => !handles.includes(String(r.handle)))) throw new Error("Collection list changed; refresh and try again");
    for (const [index, handle] of handles.entries()) {
      await conn.execute("UPDATE collections SET sort_order=?, menu_order=? WHERE handle=?", [index, index, handle]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function deleteCollection(handle: string) {
  if (CORE.has(handle)) return false;
  const [result] = await db().execute<ResultSetHeader>("DELETE FROM collections WHERE handle=?", [handle]);
  return result.affectedRows > 0;
}

export async function getCollectionRedirect(handle: string) {
  const [rows] = await db().execute<RowDataPacket[]>("SELECT destination_path FROM redirects WHERE source_path=? LIMIT 1", [`/collections/${handle}`]);
  return rows[0]?.destination_path as string | undefined;
}

export async function getCollectionProductHandles(handle: string) {
  const [rows] = await db().execute<RowDataPacket[]>(
    "SELECT p.handle FROM collection_products cp JOIN collections c ON c.id=cp.collection_id JOIN products p ON p.id=cp.product_id WHERE c.handle=? ORDER BY cp.sort_order, cp.product_id",
    [handle],
  );
  return rows.map((r) => String(r.handle));
}
