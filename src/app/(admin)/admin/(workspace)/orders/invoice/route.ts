import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin-auth";
import { ensureCreditNotesForOrder, readCreditNote } from "@/lib/server/credit-notes";
import { renderInvoicePdf } from "@/lib/server/invoice-render";
import { ensureInvoicesForOrders, InvoiceNotApplicableError, MissingTaxDetailsError, pdfFileName } from "@/lib/server/invoices";

const idList = z.array(z.coerce.number().int().positive()).min(1).max(50).refine((ids) => new Set(ids).size === ids.length);
const one = z.coerce.number().int().positive();
const pdf = (buffer: Buffer, name: string) => new Response(new Uint8Array(buffer), {
  headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" },
});

/** GET ?id=<order> | ?ids=1,2,3 (bulk, one PDF) | ?id=<order>&cn=<creditNoteId|latest> (credit note). */
export async function GET(request: Request) {
  try { await requireAdmin(); }
  catch { return new Response("Unauthorized", { status: 401 }); }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const ids = url.searchParams.get("ids");
  const cn = url.searchParams.get("cn");
  if (!!id === !!ids) return new Response("Use one order id or a comma-separated ids list", { status: 400 });

  if (cn !== null) {
    const orderId = one.safeParse(id);
    const noteId = cn === "latest" ? undefined : one.safeParse(cn);
    if (!orderId.success || (noteId && !noteId.success)) return new Response("Invalid credit note selection", { status: 400 });
    await ensureCreditNotesForOrder(orderId.data).catch((error) => console.error("Credit note sync failed", orderId.data, error));
    const note = await readCreditNote(orderId.data, noteId?.data);
    if (!note) return new Response("No credit note for this order", { status: 404 });
    return pdf(await renderInvoicePdf([note]), pdfFileName("Credit-Note", note.invoiceNo));
  }

  const parsed = idList.safeParse(id ? [id] : ids?.split(","));
  if (!parsed.success) return new Response("Invalid order selection", { status: 400 });
  try {
    const invoices = await ensureInvoicesForOrders(parsed.data);
    const name = invoices.length === 1 ? pdfFileName("Invoice", invoices[0].invoiceNo) : `Swadeshi-Mahadev-Invoices-${invoices.length}.pdf`;
    return pdf(await renderInvoicePdf(invoices), name);
  } catch (error) {
    if (error instanceof MissingTaxDetailsError || error instanceof InvoiceNotApplicableError) return new Response(error.message, { status: 409 });
    const message = error instanceof Error ? error.message : "Could not create invoice";
    const status = message === "Order not found" ? 404 : 409;
    return new Response(message, { status });
  }
}
