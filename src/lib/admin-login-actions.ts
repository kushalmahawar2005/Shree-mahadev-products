"use server";

import { timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, createSessionToken, SESSION_DAYS } from "@/lib/admin-session";

export type LoginState = { error?: string } | undefined;

// Simple in-memory throttle: 5 failed tries per IP per 15 minutes.
const g = globalThis as unknown as { __adminFails?: Map<string, { n: number; until: number }> };
const fails = (g.__adminFails ??= new Map());
const WINDOW = 15 * 60_000;

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Only allow redirects back into /admin. */
const safeNext = (n: unknown) => (typeof n === "string" && /^\/admin(\/|$|\?)/.test(n) && !n.startsWith("//") ? n : "/admin");

export async function loginAction(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const rec = fails.get(ip);
  if (rec && rec.n >= 5 && rec.until > Date.now()) {
    return { error: `Too many attempts. Try again in ${Math.ceil((rec.until - Date.now()) / 60_000)} min.` };
  }

  const user = String(fd.get("username") ?? "").trim();
  const pass = String(fd.get("password") ?? "");
  const expectedUser = process.env.ADMIN_USER ?? "admin";
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedPass) return { error: "Admin login is not configured (ADMIN_PASSWORD)." };

  if (!same(user, expectedUser) || !same(pass, expectedPass)) {
    const r = rec && rec.until > Date.now() ? rec : { n: 0, until: Date.now() + WINDOW };
    fails.set(ip, { n: r.n + 1, until: r.until });
    return { error: "Wrong username or password." };
  }
  fails.delete(ip);

  (await cookies()).set(ADMIN_COOKIE, await createSessionToken(expectedUser), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  redirect(safeNext(fd.get("next")));
}

export async function logoutAction() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
