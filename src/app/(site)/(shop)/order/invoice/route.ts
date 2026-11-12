import { renderInvoicePdf } from "@/lib/server/invoice-render";
import { ensureInvoiceForOrder, InvoiceNotApplicableError, MissingTaxDetailsError, pdfFileName } from "@/lib/server/invoices";
import { getOrderByToken } from "@/lib/server/orders";

/** GET /order/invoice?t=<order token> — invoice link from the order emails (no login needed). */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const order = await getOrderByToken(token);
  if (!order) return new Response("Invoice link is invalid", { status: 404 });
  try {
    const invoice = await ensureInvoiceForOrder(order.id);
    const pdf = await renderInvoicePdf([invoice]);
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${pdfFileName("Invoice", invoice.invoiceNo)}"`, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof InvoiceNotApplicableError) return new Response(error.message, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    if (error instanceof MissingTaxDetailsError) {
      console.error("Invoice blocked by missing tax details", order.orderNo, error.message);
      return new Response("Your invoice is being prepared. Please try again later or contact us.", { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Could not create invoice";
    return new Response(message === "Order not found" ? message : "Could not create invoice", { status: message === "Order not found" ? 404 : 500 });
  }
}
