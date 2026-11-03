import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin-session";

/** Server actions can be POSTed to any route, so admin actions re-check the session themselves. */
export async function requireAdmin() {
  const session = await verifySessionToken((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!session) throw new Error("Unauthorized. Please log in again.");
  return session;
}
