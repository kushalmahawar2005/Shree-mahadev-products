"use server";

import { safe } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAdminActivity, requireRole } from "@/lib/server/admin-auth";
import { acceptAdminInvite, createAdminInvite, removeAdminUser } from "@/lib/server/admin-users";

const Role = z.enum(["owner", "manager", "staff"]);

export async function createAdminInviteAction(raw: unknown) {
  return safe(async () => {
    const admin = await requireRole("owner");
    const parsed = z.object({ email: z.string().trim().email().max(160), role: Role }).safeParse(raw);
    if (!parsed.success) throw new Error("Enter a valid email and role.");
    const token = await createAdminInvite(parsed.data.email, parsed.data.role, admin.username);
    await logAdminActivity(admin.username, "admin.invited", parsed.data.email, { role: parsed.data.role });
    revalidatePath("/admin/settings/users");
    return { token };
  });
}

export async function removeAdminUserAction(id: number) {
  return safe(async () => {
    const admin = await requireRole("owner");
    if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid admin user.");
    await removeAdminUser(id, admin.username);
    await logAdminActivity(admin.username, "admin.removed", String(id));
    revalidatePath("/admin/settings/users");
  });
}

export async function acceptAdminInviteAction(raw: unknown) {
  return safe(async () => {
    const parsed = z.object({
      token: z.string().regex(/^[a-f0-9]{64}$/),
      username: z.string().trim().min(2).max(60).regex(/^[A-Za-z0-9_.-]+$/),
      password: z.string().min(12).max(200),
    }).safeParse(raw);
    if (!parsed.success) throw new Error("Use a valid invite, username, and 12-character password.");
    await acceptAdminInvite(parsed.data.token, parsed.data.username, parsed.data.password);
  });
}
