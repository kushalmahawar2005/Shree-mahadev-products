"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { ADMIN_COOKIE, createSessionToken, SESSION_DAYS, verifySessionToken } from "@/lib/admin-session";
import { db } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/password";
import { clientIp, rateLimit, resetLimit } from "@/lib/server/rate-limit";

export type LoginState = { error?: string } | undefined;

const Login = z.object({ username: z.string().trim().min(1).max(60), password: z.string().min(1).max(200), next: z.string().max(300).optional() });

/** Only allow redirects back into /admin. */
const safeNext = (n: unknown) => (typeof n === "string" && /^\/admin(\/|$|\?)/.test(n) && !n.startsWith("//") ? n : "/admin");

export async function loginAction(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const ip = await clientIp();
  const limit = await rateLimit("login", ip, 5, 15);
  if (!limit.ok) return { error: `Too many attempts. Try again in ${limit.retryInMin} min.` };

  const parsed = Login.safeParse({ username: fd.get("username"), password: fd.get("password"), next: fd.get("next") ?? undefined });
  if (!parsed.success) return { error: "Enter your username and password." };
  // Per username, whatever the IP: stops password guessing from rotating addresses.
  const userKey = parsed.data.username.toLowerCase();
  const userLimit = await rateLimit("login_user", userKey, 10, 30);
  if (!userLimit.ok) return { error: `Too many attempts for this account. Try again in ${userLimit.retryInMin} min.` };

  const [[u]] = await db().query<RowDataPacket[]>("SELECT id, username, password_hash, session_version FROM admin_users WHERE username = ?", [parsed.data.username]);
  if (!u) {
    const [[c]] = await db().query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM admin_users");
    if (Number(c.n) === 0) return { error: "No admin account yet. Run: pnpm admin:create <username> <password>" };
  }
  // Always run a hash check so timing doesn't reveal which usernames exist.
  const ok = await verifyPassword(parsed.data.password, u?.password_hash ?? "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA").catch(() => false);
  if (!u || !ok) return { error: "Wrong username or password." };

  await resetLimit("login", ip);
  await resetLimit("login_user", userKey);
  await db().execute("UPDATE admin_users SET last_login_at = NOW() WHERE id = ?", [u.id]);
  (await cookies()).set(ADMIN_COOKIE, await createSessionToken(u.username, u.session_version), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  redirect(safeNext(parsed.data.next));
}

export async function logoutAction() {
  const jar = await cookies();
  // End the session server-side too: bumping session_version invalidates this token (and any copy of it).
  const session = await verifySessionToken(jar.get(ADMIN_COOKIE)?.value);
  if (session) await db().execute("UPDATE admin_users SET session_version = session_version + 1 WHERE username = ? AND session_version = ?", [session.u, session.v]).catch((e) => console.error("logout", e));
  jar.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
