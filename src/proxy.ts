import { NextResponse, type NextRequest } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin-session";
import { db } from "@/lib/server/db";
import { content, type ContentKind } from "@/content/registry";

/**
 * Real HTTP 404 for unknown handles. The site layout starts streaming before the page can call
 * notFound(), so the page alone would send a 200 "soft 404". Rewriting to a path no route matches
 * renders global-not-found with a proper 404 status.
 */
function notFoundResponse(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/__not-found";
  url.search = "";
  return NextResponse.rewrite(url, { status: 404 });
}

const CONTENT_PREFIX: Record<string, ContentKind> = { "/journal/": "journal", "/recipes/": "recipes", "/policies/": "policies" };

/** One path segment after the prefix, or null when the path is the index or deeper. */
function handleAfter(pathname: string, prefix: string) {
  const handle = decodeURIComponent(pathname.slice(prefix.length));
  return handle && !handle.includes("/") ? handle : null;
}

async function exists(sql: string, handle: string) {
  try {
    const [rows] = await db().execute<RowDataPacket[]>(sql, [handle]);
    return rows.length > 0;
  } catch (error) {
    // DB hiccup: let the page render (it still calls notFound()) rather than 404 a real product.
    console.error("Handle lookup failed", error);
    return true;
  }
}

/** Admin gate: every /admin page needs a valid signed session cookie, except the login page. */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  for (const [prefix, kind] of Object.entries(CONTENT_PREFIX)) {
    const slug = pathname.startsWith(prefix) ? handleAfter(pathname, prefix) : null;
    if (slug && !content[kind].some((e) => e.slug === slug)) return notFoundResponse(req);
  }
  if (process.env.DATABASE_NAME && pathname.startsWith("/products/")) {
    const handle = handleAfter(pathname, "/products/");
    if (handle && !(await exists("SELECT 1 FROM products WHERE handle = ? AND status = 'active' LIMIT 1", handle))) {
      return notFoundResponse(req);
    }
  }
  if (process.env.DATABASE_NAME && pathname.startsWith("/collections/")) {
    const handle = pathname.slice("/collections/".length);
    if (handle && !handle.includes("/")) {
      try {
        const [rows] = await db().execute<RowDataPacket[]>(
          "SELECT destination_path FROM redirects WHERE source_path=? LIMIT 1",
          [`/collections/${handle}`],
        );
        const destination = rows[0]?.destination_path;
        if (typeof destination === "string" && destination.startsWith("/collections/")) {
          const url = req.nextUrl.clone();
          url.pathname = destination;
          return NextResponse.redirect(url, 301);
        }
      } catch (error) {
        console.error("Collection redirect lookup failed", error);
      }
      if (!(await exists("SELECT 1 FROM collections WHERE handle = ? AND active = 1 LIMIT 1", decodeURIComponent(handle)))) {
        return notFoundResponse(req);
      }
    }
  }
  // Account area: no customer cookie → sign in first, then come back. (The layout verifies the session.)
  if (pathname === "/account" || pathname.startsWith("/account/")) {
    if (req.cookies.get("smp_customer")?.value) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (pathname === "/admin/login") {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-admin-public", "1");
    return NextResponse.next({ request: { headers: requestHeaders } });
  }
  const session = await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
  if (session) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/products/:handle",
    "/collections/:handle",
    "/journal/:slug",
    "/recipes/:slug",
    "/policies/:slug",
    "/account",
    "/account/:path*",
  ],
};
