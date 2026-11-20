import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2/promise";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin-session";
import { db } from "./db";

/**
 * Server actions can be POSTed to any route, so admin actions re-check the session themselves (incl. DB version).
 * Wrapped in React `cache`: the layout, the page guard and the page itself share one lookup per request.
 */
export const requireAdmin = cache(async function requireAdmin() {
  const session = await verifySessionToken((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!session) throw new Error("Unauthorized. Please log in again.");
  const [[u]] = await db().query<RowDataPacket[]>("SELECT id, role, session_version FROM admin_users WHERE username = ?", [session.u]);
  if (!u || u.session_version !== session.v) throw new Error("Session expired. Please log in again.");
  return { username: session.u, role: u.role as string, id: u.id as number };
});

export type AdminRole = "owner" | "manager" | "staff";

export async function requireRole(...allowed: AdminRole[]) {
  const admin = await requireAdmin();
  if (!allowed.includes(admin.role as AdminRole)) {
    throw new Error("You do not have permission for this action.");
  }
  return admin as typeof admin & { role: AdminRole };
}

export async function logAdminActivity(
  adminUsername: string,
  action: string,
  target?: string,
  meta?: unknown,
) {
  await db().execute(
    "INSERT INTO activity_log (admin_username, action, target, meta) VALUES (?,?,?,?)",
    [adminUsername, action.slice(0, 80), target?.slice(0, 160) ?? null, meta === undefined ? null : JSON.stringify(meta)],
  );
}
