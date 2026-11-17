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

/**
 * Active product / collection handles and collection redirects, cached per process for a minute, so
 * a product page request no longer waits on a DB round-trip (one small query per minute instead).
 * A just-added product can 404 for up to a minute; a DB hiccup lets the page render (it still 404s itself).
 */
const LOOKUP_TTL = 60_000;
type Lookups = { at: number; products: Set<string>; collections: Set<string>; redirects: Map<string, string> };
let lookups: Lookups | null = null;
let loading: Promise<Lookups | null> | null = null;
async function getLookups(): Promise<Lookups | null> {
  if (lookups && Date.now() - lookups.at < LOOKUP_TTL) return lookups;
  loading ??= (async () => {
    try {
      const [[p], [c], [r]] = await Promise.all([
        db().query<RowDataPacket[]>("SELECT handle FROM products WHERE status = 'active'"),
        db().query<RowDataPacket[]>("SELECT handle FROM collections WHERE active = 1"),
        db().query<RowDataPacket[]>("SELECT source_path, destination_path FROM redirects WHERE source_path LIKE '/collections/%'"),
      ]);
      lookups = {
        at: Date.now(),
        products: new Set(p.map((x) => String(x.handle))),
        collections: new Set(c.map((x) => String(x.handle))),
        redirects: new Map(r.map((x) => [String(x.source_path), String(x.destination_path)])),
      };
      return lookups;
    } catch (error) {
      console.error("Handle lookup failed", error);
      return lookups; // keep serving the last good list (or null = allow)
    } finally {
      loading = null;
    }
  })();
  return loading;
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
    const l = handle ? await getLookups() : null;
    if (handle && l && !l.products.has(handle)) return notFoundResponse(req);
  }
  if (process.env.DATABASE_NAME && pathname.startsWith("/collections/")) {
    const handle = pathname.slice("/collections/".length);
    if (handle && !handle.includes("/")) {
      const l = await getLookups();
      const destination = l?.redirects.get(`/collections/${handle}`);
      if (destination?.startsWith("/collections/")) {
        const url = req.nextUrl.clone();
        url.pathname = destination;
        return NextResponse.redirect(url, 301);
      }
      if (l && !l.collections.has(decodeURIComponent(handle))) return notFoundResponse(req);
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
