"use server";

import { safe, type ActionResult } from "@/lib/action-result";
import { parseReelLink, reelLinkHref } from "@/lib/reel-link";
import { updateTag } from "next/cache";
import { TAGS } from "@/lib/commerce";
import { requireAdmin, requireRole } from "@/lib/server/admin-auth";
import {
  cloudinaryConfigured,
  destroyImage,
  isOwnCloudinaryUrl,
  signUpload,
  type UploadFolder,
} from "@/lib/server/cloudinary";
import {
  addReelLink,
  addReels,
  deleteReel,
  replaceReelVideo,
  REEL_PLACEMENTS,
  type ReelPlacement,
  listReels,
  reorderReels,
  setSetting,
  updateReel,
  type Reel,
} from "@/lib/server/videos";
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

export type UploadedImage = {
  publicId: string;
  url: string;
  width: number;
  height: number;
  duration?: number;
};

const HANDLE = /^[a-z0-9-]{2,80}$/;
const okId = (n: unknown) => Number.isInteger(n) && (n as number) > 0;

function checkUpload(u: UploadedImage) {
  if (!u || !isOwnCloudinaryUrl(u.url, u.publicId))
    throw new Error("Invalid upload");
  if (!okId(u.width) || !okId(u.height)) throw new Error("Invalid image size");
}

export async function signUploadAction(folder: UploadFolder) {
  return safe(async () => {
    // Review photos are part of moderation (any admin); catalog/site media is owner/manager only.
    if (folder === "reviews") await requireAdmin();
    else await requireRole("owner", "manager");
    if (!cloudinaryConfigured()) throw new Error("Cloudinary is not configured");
    if (
      folder !== "products" &&
      folder !== "banners" &&
      folder !== "reels" &&
      folder !== "reviews" &&
      folder !== "collections"
    )
      throw new Error("Invalid folder");
    return signUpload(folder);
  });
}

// ───────────── Product images ─────────────

function bustProduct(handle: string) {
  updateTag(TAGS.products);
  updateTag(TAGS.product(handle));
}

export async function addProductImagesAction(
  handle: string,
  uploads: UploadedImage[],
  alt: string,
): Promise<ActionResult<ProductImage[]>> {
  return safe(async () => {
    await requireRole("owner", "manager");
    if (!HANDLE.test(handle) || !Array.isArray(uploads) || uploads.length > 20)
      throw new Error("Invalid request");
    uploads.forEach(checkUpload);
    await addProductImages(
      handle,
      uploads.map((u) => ({ ...u, alt: String(alt).slice(0, 255) })),
    );
    bustProduct(handle);
    return getProductImages(handle);
  });
}

export async function reorderProductImagesAction(
  handle: string,
  ids: number[],
) {
  return safe(async () => {
    await requireRole("owner", "manager");
    if (!HANDLE.test(handle) || !Array.isArray(ids) || !ids.every(okId))
      throw new Error("Invalid request");
    await reorderProductImages(handle, ids);
    bustProduct(handle);
  });
}

export async function updateProductImageAltAction(
  handle: string,
  id: number,
  alt: string,
) {
  return safe(async () => {
    await requireRole("owner", "manager");
    if (!HANDLE.test(handle) || !okId(id)) throw new Error("Invalid request");
    await updateProductImageAlt(id, String(alt));
    bustProduct(handle);
  });
}

export async function deleteProductImageAction(id: number) {
  return safe(async () => {
    await requireRole("owner", "manager");
    if (!okId(id)) throw new Error("Invalid request");
    const gone = await deleteProductImage(id);
    if (gone) {
      await destroyImage(gone.publicId);
      bustProduct(gone.handle);
    }
  });
}

// ───────────── Hero banners ─────────────

export async function createBannersAction(
  uploads: UploadedImage[],
): Promise<ActionResult<Banner[]>> {
  return safe(async () => {
    await requireRole("owner", "manager");
    if (!Array.isArray(uploads) || uploads.length > 10)
      throw new Error("Invalid request");
    uploads.forEach(checkUpload);
    for (const u of uploads)
      await createBanner({ url: u.url, publicId: u.publicId });
    updateTag(TAGS.banners);
    return listBanners();
  });
}

export async function updateBannerAction(
  id: number,
  patch: {
    alt?: string;
    href?: string;
    active?: boolean;
    desktop?: UploadedImage;
    mobile?: UploadedImage | null;
  },
): Promise<ActionResult<Banner[]>> {
  return safe(async () => {
    await requireRole("owner", "manager");
    if (!okId(id)) throw new Error("Invalid request");
    if (patch.desktop) checkUpload(patch.desktop);
    if (patch.mobile) checkUpload(patch.mobile);
    if (patch.href !== undefined && !/^(\/|https:\/\/)/.test(patch.href))
      throw new Error("Link must start with / or https://");
    const orphaned = await updateBanner(id, {
      alt: patch.alt,
      href: patch.href,
      active: patch.active,
      desktop: patch.desktop && {
        url: patch.desktop.url,
        publicId: patch.desktop.publicId,
      },
      mobile:
        patch.mobile === undefined
          ? undefined
          : patch.mobile && {
              url: patch.mobile.url,
              publicId: patch.mobile.publicId,
            },
    });
    await Promise.all(orphaned.map((id) => destroyImage(id)));
    updateTag(TAGS.banners);
    return listBanners();
  });
}

export async function reorderBannersAction(ids: number[]) {
  return safe(async () => {
    await requireRole("owner", "manager");
    if (!Array.isArray(ids) || !ids.every(okId))
      throw new Error("Invalid request");
    await reorderBanners(ids);
    updateTag(TAGS.banners);
  });
}

export async function deleteBannerAction(id: number): Promise<ActionResult<Banner[]>> {
  return safe(async () => {
    await requireRole("owner", "manager");
    if (!okId(id)) throw new Error("Invalid request");
    await Promise.all((await deleteBanner(id)).map((id) => destroyImage(id)));
    updateTag(TAGS.banners);
    return listBanners();
  });
}

// ───────────── Homepage videos ─────────────

function bustVideos() {
  updateTag("videos");
}

const okPlaces = (p: unknown): ReelPlacement[] => {
  if (!Array.isArray(p) || !p.length || p.some((x) => !REEL_PLACEMENTS.includes(x))) throw new Error("Pick where the reel should show");
  return [...new Set(p as ReelPlacement[])];
};

export async function addReelsAction(
  uploads: UploadedImage[],
  placements: ReelPlacement[] = ["home"],
  /** Product edit page: tag the new reels with this product. */
  productHandle?: string,
): Promise<ActionResult<Reel[]>> {
  return safe(async () => {
    await requireRole("owner", "manager");
    if (productHandle !== undefined && !/^[a-z0-9-]{1,120}$/.test(productHandle)) throw new Error("Invalid product");
    if (!Array.isArray(uploads) || uploads.length > 10)
      throw new Error("Invalid request");
    uploads.forEach(checkUpload);
    if (!uploads.every((u) => u.url.includes("/video/upload/")))
      throw new Error("Only videos can be added here");
    await addReels(
      uploads.map((u) => ({
        ...u,
        duration: Number.isFinite(u.duration) ? u.duration : undefined,
      })),
      okPlaces(placements),
      productHandle ?? null,
    );
    bustVideos();
    return listReels();
  });
}

export async function updateReelAction(
  id: number,
  patch: {
    caption?: string;
    productHandle?: string | null;
    instagramUrl?: string | null;
    active?: boolean;
    placements?: ReelPlacement[];
  },
): Promise<ActionResult<Reel[]>> {
  return safe(async () => {
    await requireRole("owner", "manager");
    if (!okId(id)) throw new Error("Invalid request");
    if (patch.productHandle && !HANDLE.test(patch.productHandle))
      throw new Error("Pick a product from the list");
    if (
      patch.instagramUrl &&
      !/^https:\/\/(www\.)?instagram\.com\//.test(patch.instagramUrl)
    ) {
      throw new Error(
        "Instagram link must start with https://www.instagram.com/",
      );
    }
    if (patch.placements && (!Array.isArray(patch.placements) || patch.placements.some((p) => !REEL_PLACEMENTS.includes(p)))) {
      throw new Error("Invalid place");
    }
    await updateReel(id, {
      ...patch,
      placements: patch.placements ? [...new Set(patch.placements)] : undefined,
      productHandle:
        patch.productHandle === undefined
          ? undefined
          : patch.productHandle || null,
      instagramUrl:
        patch.instagramUrl === undefined ? undefined : patch.instagramUrl || null,
    });
    bustVideos();
    return listReels();
  });
}

export async function reorderReelsAction(ids: number[]) {
  return safe(async () => {
    await requireRole("owner", "manager");
    if (!Array.isArray(ids) || !ids.every(okId))
      throw new Error("Invalid request");
    await reorderReels(ids);
    bustVideos();
  });
}

/** Add a reel from a YouTube (Shorts) link: it plays in YouTube's embedded player. */
export async function addReelLinkAction(url: string, placements: ReelPlacement[] = ["home"]): Promise<ActionResult<Reel[]>> {
  return safe(async () => {
    await requireRole("owner", "manager");
    const parsed = parseReelLink(String(url ?? "").slice(0, 300));
    if (!parsed.ok) throw new Error(parsed.error);
    await addReelLink(reelLinkHref(parsed.link), okPlaces(placements));
    bustVideos();
    return listReels();
  });
}

/** Replace a reel's video with a new upload; places, caption, product and order stay as they are. */
export async function replaceReelVideoAction(id: number, upload: UploadedImage): Promise<ActionResult<Reel[]>> {
  return safe(async () => {
    await requireRole("owner", "manager");
    if (!okId(id)) throw new Error("Invalid request");
    checkUpload(upload);
    if (!upload.url.includes("/video/upload/")) throw new Error("Only videos can be added here");
    const old = await replaceReelVideo(id, { ...upload, duration: Number.isFinite(upload.duration) ? upload.duration : undefined });
    if (old && old !== upload.publicId) await destroyImage(old, "video").catch((e) => console.error("old reel file not deleted", e));
    bustVideos();
    return listReels();
  });
}

export async function deleteReelAction(id: number): Promise<ActionResult<Reel[]>> {
  return safe(async () => {
    await requireRole("owner", "manager");
    if (!okId(id)) throw new Error("Invalid request");
    const publicId = await deleteReel(id);
    if (publicId) await destroyImage(publicId, "video");
    bustVideos();
    return listReels();
  });
}

export async function setBrandFilmAction(youtube: string) {
  return safe(async () => {
    await requireRole("owner", "manager");
    const v = String(youtube ?? "")
      .trim()
      .slice(0, 300);
    if (
      v &&
      !/^(https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\/|[\w-]{11}$)/.test(v)
    ) {
      throw new Error("Paste a YouTube link");
    }
    await setSetting("brand_film_youtube", v);
    bustVideos();
  });
}
