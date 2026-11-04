import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument } from "./invoice-pdf";
import type { InvoiceSnapshot } from "./invoices";

export async function renderInvoicePdf(invoices: InvoiceSnapshot[]) {
  return renderToBuffer(<InvoiceDocument invoices={invoices} />);
}
