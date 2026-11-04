import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getOutboxHtml } from "@/lib/server/mail";

/** Admin-only preview of a stored email (exactly what the customer got). */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const id = Number(req.nextUrl.searchParams.get("id"));
  const html = Number.isInteger(id) && id > 0 ? await getOutboxHtml(id) : null;
  if (!html) return new Response("Not found", { status: 404 });
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
