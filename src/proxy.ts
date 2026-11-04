import { NextResponse, type NextRequest } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin-session";
import { db } from "@/lib/server/db";

/** Admin gate: every /admin page needs a valid signed session cookie, except the login page. */
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
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
    }
  }
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (pathname === "/admin/login") return NextResponse.next();
  const session = await verifySessionToken(req.cookies.get(ADMIN_COOKIE)?.value);
  if (session) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin", "/admin/:path*", "/collections/:handle"] };
