"use server";

import { safe } from "@/lib/action-result";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { TAGS } from "@/lib/commerce";
import { requireRole } from "@/lib/server/admin-auth";
import { deleteCollection, saveCollection, saveCollectionOrder, type CollectionInput } from "@/lib/server/collections";

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const fields = z.object({
  handle: z.string().trim().min(2).max(80).regex(HANDLE),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(5000),
  imageUrl: z.string().trim().max(500).optional().default(""),
  seoTitle: z.string().trim().max(160).optional().default(""),
  seoDescription: z.string().trim().max(320).optional().default(""),
  inMenu: z.boolean(),
  menuOrder: z.number().int().min(0).max(10000),
  showHomepage: z.boolean(),
  products: z.array(z.string().regex(HANDLE)).max(500),
}).strict();
const pathHandle = z.string().regex(HANDLE);

function invalidate(handles: string[]) {
  updateTag(TAGS.collections);
  updateTag(TAGS.products);
  for (const handle of handles) {
    updateTag(TAGS.collection(handle));
    revalidatePath(`/collections/${handle}`);
  }
  revalidatePath("/");
  revalidatePath("/shop");
}

function checkedImage(value: string) {
  if (!value) return "";
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Collection image must be a valid Cloudinary URL"); }
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloud || url.hostname !== "res.cloudinary.com" || !url.pathname.startsWith(`/${cloud}/image/upload/`) || !url.pathname.includes("swadeshi-mahadev/collections/")) {
    throw new Error("Choose a collection image uploaded to this store's Cloudinary collection folder");
  }
  return url.toString();
}

export async function saveCollectionAction(raw: unknown, originalHandle?: string) {
  return safe(async () => {
    await requireRole("owner", "manager");
    const input = fields.parse(raw);
    if (new Set(input.products).size !== input.products.length) throw new Error("A product can only appear once in a collection");
    const original = originalHandle === undefined ? undefined : pathHandle.parse(originalHandle);
    const data: CollectionInput = { ...input, imageUrl: checkedImage(input.imageUrl) };
    try {
      const result = await saveCollection(data, original);
      invalidate([result.handle, ...(result.previousHandle && result.previousHandle !== result.handle ? [result.previousHandle] : [])]);
      return result;
    } catch (e) {
      if ((e as { code?: string }).code === "ER_DUP_ENTRY") throw new Error("That collection URL is already in use");
      throw e;
    }
  });
}

export async function reorderCollectionsAction(raw: unknown) {
  return safe(async () => {
    await requireRole("owner", "manager");
    const handles = z.array(pathHandle).max(500).parse(raw);
    if (new Set(handles).size !== handles.length) throw new Error("Duplicate collection in order");
    await saveCollectionOrder(handles);
    invalidate(handles);
  });
}

export async function deleteCollectionAction(raw: unknown) {
  return safe(async () => {
    await requireRole("owner", "manager");
    const handle = pathHandle.parse(raw);
    const deleted = await deleteCollection(handle);
    if (deleted) invalidate([handle]);
    return deleted;
  });
}
