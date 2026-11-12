import { NextResponse } from "next/server";
import { ensureCreditNotesForOrder, readCreditNote } from "@/lib/server/credit-notes";
import { getCustomerSession } from "@/lib/server/customer-auth";
import { db } from "@/lib/server/db";
import { renderInvoicePdf } from "@/lib/server/invoice-render";
import { pdfFileName } from "@/lib/server/invoices";
import type { RowDataPacket } from "mysql2/promise";

const notFound = (error = "Order not found") => NextResponse.json({ error }, { status: 404, headers: { "Cache-Control": "private, no-store" } });

/** GET /api/account/orders/:id/credit-note[?n=<creditNoteId>] — credit note PDF (latest when n is omitted). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const nRaw = new URL(req.url).searchParams.get("n");
  const n = nRaw === null ? undefined : Number(nRaw);
  const session = await getCustomerSession();
  if (!session || !Number.isSafeInteger(id) || id <= 0 || (n !== undefined && (!Number.isSafeInteger(n) || n <= 0))) return notFound();
  const [[own]] = await db().execute<RowDataPacket[]>("SELECT id FROM orders WHERE id=? AND customer_id=?", [id, session.id]);
  if (!own) return notFound();
  try {
    // Self-heal: issue any note a refund/cancellation should have produced.
    await ensureCreditNotesForOrder(id).catch((error) => console.error("Credit note sync failed", id, error));
    const note = await readCreditNote(id, n);
    if (!note) return notFound("There is no credit note for this order.");
    const pdf = await renderInvoicePdf([note]);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdfFileName("Credit-Note", note.invoiceNo)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Credit note download failed", id, error);
    return NextResponse.json({ error: "Could not prepare the credit note. Please try again." }, { status: 500 });
  }
}
