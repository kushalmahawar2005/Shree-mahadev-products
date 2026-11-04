import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-auth";
import { renderInvoicePdf } from "@/lib/server/invoice-render";
import { ensureInvoiceForOrder, MissingTaxDetailsError } from "@/lib/server/invoices";

const idList = z.array(z.coerce.number().int().positive()).min(1).max(50).refine((ids) => new Set(ids).size === ids.length);

export async function GET(request: Request) {
  try { await requireAdmin(); }
  catch { return new Response("Unauthorized", { status: 401 }); }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const ids = url.searchParams.get("ids");
  if (!!id === !!ids) return new Response("Use one order id or a comma-separated ids list", { status: 400 });
  const parsed = idList.safeParse(id ? [id] : ids?.split(","));
  if (!parsed.success) return new Response("Invalid order selection", { status: 400 });
  try {
    const invoices = await Promise.all(parsed.data.map((orderId) => ensureInvoiceForOrder(orderId)));
    const pdf = await renderInvoicePdf(invoices);
    const name = invoices.length === 1 ? `${invoices[0].invoiceNo.replaceAll("/", "-")}.pdf` : `Swadeshi-Mahadev-Invoices-${invoices.length}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof MissingTaxDetailsError) return new Response(error.message, { status: 409 });
    const message = error instanceof Error ? error.message : "Could not create invoice";
    const status = message === "Order not found" ? 404 : 409;
    return new Response(message, { status });
  }
}
