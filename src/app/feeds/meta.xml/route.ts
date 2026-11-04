import { buildProductFeed } from "@/lib/server/product-feeds";

export async function GET() {
  return new Response(await buildProductFeed("meta"), {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=900" },
  });
}
