import { PDFDocument } from "pdf-lib";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-auth";
import { labelUrls } from "@/lib/server/bulk-orders";

const idList = z.array(z.coerce.number().int().positive()).min(1).max(50);

/** GET ?ids=1,2,3 → every selected order's shipping label merged into one PDF, ready to print. */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const parsed = idList.safeParse(new URL(request.url).searchParams.get("ids")?.split(","));
  if (!parsed.success) return new Response("Invalid order selection", { status: 400 });

  const { urls } = await labelUrls([...new Set(parsed.data)]);
  if (!urls.length) return new Response("None of the selected orders has a booked shipment yet.", { status: 404 });

  const merged = await PDFDocument.create();
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const src = await PDFDocument.load(await res.arrayBuffer(), { ignoreEncryption: true });
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    } catch (error) {
      console.error("Label merge failed", url, error);
    }
  }
  if (!merged.getPageCount()) return new Response("Could not download the labels from NimbusPost. Try again in a minute.", { status: 502 });
  const bytes = await merged.save();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Shipping-labels-${urls.length}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
