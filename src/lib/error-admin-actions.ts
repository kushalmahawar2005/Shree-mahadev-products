"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { safe } from "@/lib/action-result";
import { requireRole } from "@/lib/server/admin-auth";
import { resolveErrors } from "@/lib/server/error-log";

/** Mark errors as fixed / seen. A resolved error reopens by itself if it happens again. */
export async function resolveErrorsAction(ids: number[] | "all") {
  return safe(async () => {
    await requireRole("owner", "manager");
    const v = ids === "all" ? "all" : z.array(z.number().int().positive()).max(500).parse(ids);
    await resolveErrors(v);
    revalidatePath("/admin/errors");
  });
}
