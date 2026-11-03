import "server-only";
import { headers } from "next/headers";

/** Server actions can be POSTed to any route, so admin actions re-check the basic-auth header themselves. */
export async function requireAdmin() {
  const pass = process.env.ADMIN_PASSWORD;
  const h = (await headers()).get("authorization") ?? "";
  if (pass && h.startsWith("Basic ")) {
    const [u, ...rest] = Buffer.from(h.slice(6), "base64").toString("utf8").split(":");
    if (u === (process.env.ADMIN_USER ?? "admin") && rest.join(":") === pass) return;
  }
  throw new Error("Unauthorized");
}
