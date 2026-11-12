import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/server/customer-auth";
import { db } from "@/lib/server/db";
import { renderInvoicePdf } from "@/lib/server/invoice-render";
import { ensureInvoiceForOrder, InvoiceNotApplicableError, MissingTaxDetailsError, pdfFileName } from "@/lib/server/invoices";
import type { RowDataPacket } from "mysql2/promise";

const notFound = (error = "Order not found") => NextResponse.json({ error }, { status: 404, headers: { "Cache-Control": "private, no-store" } });

/** GET /api/account/orders/:id/invoice — the signed-in shopper's GST invoice PDF (issued on demand). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const session = await getCustomerSession();
  if (!session || !Number.isSafeInteger(id) || id <= 0) return notFound();
  const [[own]] = await db().execute<RowDataPacket[]>("SELECT id FROM orders WHERE id=? AND customer_id=?", [id, session.id]);
  if (!own) return notFound();
  try {
    const invoice = await ensureInvoiceForOrder(id);
    const pdf = await renderInvoicePdf([invoice]);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdfFileName("Invoice", invoice.invoiceNo)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof InvoiceNotApplicableError) return notFound(error.message);
    if (error instanceof MissingTaxDetailsError) {
      console.error("Invoice blocked by missing tax details", id, error.message);
      return NextResponse.json({ error: "Your invoice is being prepared. Please try again later or contact us." }, { status: 409 });
    }
    console.error("Invoice download failed", id, error);
    return NextResponse.json({ error: "Could not prepare the invoice. Please try again." }, { status: 500 });
  }
}
