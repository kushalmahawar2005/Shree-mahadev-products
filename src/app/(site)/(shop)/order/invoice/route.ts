import { renderInvoicePdf } from "@/lib/server/invoice-render";
import { ensureInvoiceForOrder, MissingTaxDetailsError } from "@/lib/server/invoices";
import { getOrderByToken } from "@/lib/server/orders";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const order = await getOrderByToken(token);
  if (!order) return new Response("Invoice link is invalid", { status: 404 });
  try {
    const invoice = await ensureInvoiceForOrder(order.id);
    const pdf = await renderInvoicePdf([invoice]);
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${invoice.invoiceNo.replaceAll("/", "-")}.pdf"`, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create invoice";
    const status = error instanceof MissingTaxDetailsError ? 409 : message === "Order not found" ? 404 : 409;
    return new Response(message, { status });
  }
}
