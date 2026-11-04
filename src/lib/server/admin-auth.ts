import "server-only";
import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2/promise";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin-session";
import { db } from "./db";

/** Server actions can be POSTed to any route, so admin actions re-check the session themselves (incl. DB version). */
export async function requireAdmin() {
  const session = await verifySessionToken((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!session) throw new Error("Unauthorized. Please log in again.");
  const [[u]] = await db().query<RowDataPacket[]>("SELECT id, role, session_version FROM admin_users WHERE username = ?", [session.u]);
  if (!u || u.session_version !== session.v) throw new Error("Session expired. Please log in again.");
  return { username: session.u, role: u.role as string, id: u.id as number };
}
