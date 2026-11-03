import { NextResponse, type NextRequest } from "next/server";

/**
 * Admin panel lock: HTTP Basic auth with ADMIN_USER / ADMIN_PASSWORD.
 * Fails closed: if ADMIN_PASSWORD isn't set, /admin is unreachable.
 */
export function proxy(req: NextRequest) {
  const user = process.env.ADMIN_USER ?? "admin";
  const pass = process.env.ADMIN_PASSWORD;
  const header = req.headers.get("authorization") ?? "";
  if (pass && header.startsWith("Basic ")) {
    const [u, ...rest] = atob(header.slice(6)).split(":");
    if (u === user && rest.join(":") === pass) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Admin", charset="UTF-8"' },
  });
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
