"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { safe } from "@/lib/action-result";
import { CHECK_ICONS } from "@/data/pdp-story";
import { parseReelLink } from "@/lib/reel-link";
import { requireRole } from "@/lib/server/admin-auth";
import { PDP_STORY_TAG, readStoryOverrides, saveStoryOverrides, removeUnusedStoryMedia } from "@/lib/server/pdp-story";

const text = (max: number) => z.string().trim().min(1, "Can't be empty").max(max);
/** Site-relative path or https URL (Cloudinary uploads). */
const media = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v.startsWith("/") || /^https:\/\//.test(v), "Use an uploaded file or a link starting with https://");
const optMedia = z.union([media, z.literal("")]).optional().transform((v) => v || undefined);

const StorySchema = z.object({
  method: z
    .object({
      eyebrow: z.string().trim().max(60),
      title: text(120),
      intro: z.string().trim().max(300),
      steps: z.array(z.object({ title: text(60), body: text(240), image: optMedia })).min(1, "Add at least one step").max(8),
    })
    .optional(),
  checks: z
    .object({
      eyebrow: z.string().trim().max(60),
      title: text(120),
      intro: z.string().trim().max(300),
      items: z.array(z.object({ icon: z.enum(CHECK_ICONS), title: text(60), body: text(240), image: optMedia })).min(1, "Add at least one check").max(6),
    })
    .optional(),
  reels: z
    .array(
      z
        .object({
          video: optMedia,
          link: z.string().trim().max(300).optional().transform((v) => v || undefined),
          cover: optMedia,
          caption: z.string().trim().max(80),
        })
        .superRefine((r, ctx) => {
          if (!r.video && !r.link) ctx.addIssue({ code: "custom", message: "Upload a video or paste a reel link" });
          if (r.link) {
            const p = parseReelLink(r.link);
            if (!p.ok) ctx.addIssue({ code: "custom", path: ["link"], message: p.error });
          }
        }),
    )
    .max(12)
    .optional(),
});

const Category = z.enum(["oil", "honey", "sweetener"]);

/** Save one category's story (replaces the built-in copy for that category). */
export async function savePdpStoryAction(category: string, story: unknown) {
  return safe(async () => {
    await requireRole("owner", "manager");
    const cat = Category.parse(category);
    const parsed = StorySchema.safeParse(story);
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      throw new Error(`${i.path.join(" › ")}: ${i.message}`);
    }
    const before = await readStoryOverrides();
    const map = { ...before, [cat]: parsed.data };
    await saveStoryOverrides(map);
    updateTag(PDP_STORY_TAG);
    // Reels / photos removed in the editor: delete them from Cloudinary too (only our uploads, only if unused).
    await removeUnusedStoryMedia(before, map);
  });
}

/** Drop the saved version so the product page uses the built-in copy again. */
export async function resetPdpStoryAction(category: string) {
  return safe(async () => {
    await requireRole("owner", "manager");
    const cat = Category.parse(category);
    const before = await readStoryOverrides();
    const map = { ...before };
    delete map[cat];
    await saveStoryOverrides(map);
    updateTag(PDP_STORY_TAG);
    await removeUnusedStoryMedia(before, map);
  });
}
