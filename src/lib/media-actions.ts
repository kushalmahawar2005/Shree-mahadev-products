"use server";

import { updateTag } from "next/cache";
import { TAGS } from "@/lib/commerce";
import { requireAdmin } from "@/lib/server/admin-auth";
import { cloudinaryConfigured, destroyImage, isOwnCloudinaryUrl, signUpload, type UploadFolder } from "@/lib/server/cloudinary";
import {
  addProductImages,
  createBanner,
  deleteBanner,
  deleteProductImage,
  getProductImages,
  listBanners,
  reorderBanners,
  reorderProductImages,
  updateBanner,
  updateProductImageAlt,
  type Banner,
  type ProductImage,
} from "@/lib/server/media";

export type UploadedImage = { publicId: string; url: string; width: number; height: number };

const HANDLE = /^[a-z0-9-]{2,80}$/;
const okId = (n: unknown) => Number.isInteger(n) && (n as number) > 0;

function checkUpload(u: UploadedImage) {
  if (!u || !isOwnCloudinaryUrl(u.url, u.publicId)) throw new Error("Invalid upload");
  if (!okId(u.width) || !okId(u.height)) throw new Error("Invalid image size");
}

export async function signUploadAction(folder: UploadFolder) {
  await requireAdmin();
  if (!cloudinaryConfigured()) throw new Error("Cloudinary is not configured");
  if (folder !== "products" && folder !== "banners") throw new Error("Invalid folder");
  return signUpload(folder);
}

// ───────────── Product images ─────────────

function bustProduct(handle: string) {
  updateTag(TAGS.products);
  updateTag(TAGS.product(handle));
}

export async function addProductImagesAction(handle: string, uploads: UploadedImage[], alt: string): Promise<ProductImage[]> {
  await requireAdmin();
  if (!HANDLE.test(handle) || !Array.isArray(uploads) || uploads.length > 20) throw new Error("Invalid request");
  uploads.forEach(checkUpload);
  await addProductImages(handle, uploads.map((u) => ({ ...u, alt: String(alt).slice(0, 255) })));
  bustProduct(handle);
  return getProductImages(handle);
}

export async function reorderProductImagesAction(handle: string, ids: number[]) {
  await requireAdmin();
  if (!HANDLE.test(handle) || !Array.isArray(ids) || !ids.every(okId)) throw new Error("Invalid request");
  await reorderProductImages(handle, ids);
  bustProduct(handle);
}

export async function updateProductImageAltAction(handle: string, id: number, alt: string) {
  await requireAdmin();
  if (!HANDLE.test(handle) || !okId(id)) throw new Error("Invalid request");
  await updateProductImageAlt(id, String(alt));
  bustProduct(handle);
}

export async function deleteProductImageAction(id: number) {
  await requireAdmin();
  if (!okId(id)) throw new Error("Invalid request");
  const gone = await deleteProductImage(id);
  if (gone) {
    await destroyImage(gone.publicId);
    bustProduct(gone.handle);
  }
}

// ───────────── Hero banners ─────────────

export async function createBannersAction(uploads: UploadedImage[]): Promise<Banner[]> {
  await requireAdmin();
  if (!Array.isArray(uploads) || uploads.length > 10) throw new Error("Invalid request");
  uploads.forEach(checkUpload);
  for (const u of uploads) await createBanner({ url: u.url, publicId: u.publicId });
  updateTag(TAGS.banners);
  return listBanners();
}

export async function updateBannerAction(
  id: number,
  patch: { alt?: string; href?: string; active?: boolean; desktop?: UploadedImage; mobile?: UploadedImage | null },
): Promise<Banner[]> {
  await requireAdmin();
  if (!okId(id)) throw new Error("Invalid request");
  if (patch.desktop) checkUpload(patch.desktop);
  if (patch.mobile) checkUpload(patch.mobile);
  if (patch.href !== undefined && !/^(\/|https:\/\/)/.test(patch.href)) throw new Error("Link must start with / or https://");
  const orphaned = await updateBanner(id, {
    alt: patch.alt,
    href: patch.href,
    active: patch.active,
    desktop: patch.desktop && { url: patch.desktop.url, publicId: patch.desktop.publicId },
    mobile: patch.mobile === undefined ? undefined : patch.mobile && { url: patch.mobile.url, publicId: patch.mobile.publicId },
  });
  await Promise.all(orphaned.map(destroyImage));
  updateTag(TAGS.banners);
  return listBanners();
}

export async function reorderBannersAction(ids: number[]) {
  await requireAdmin();
  if (!Array.isArray(ids) || !ids.every(okId)) throw new Error("Invalid request");
  await reorderBanners(ids);
  updateTag(TAGS.banners);
}

export async function deleteBannerAction(id: number): Promise<Banner[]> {
  await requireAdmin();
  if (!okId(id)) throw new Error("Invalid request");
  await Promise.all((await deleteBanner(id)).map(destroyImage));
  updateTag(TAGS.banners);
  return listBanners();
}
