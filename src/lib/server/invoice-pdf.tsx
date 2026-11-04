import "server-only";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { InvoiceSnapshot } from "./invoices";

const styles = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 42, paddingHorizontal: 36, fontFamily: "Helvetica", fontSize: 9, color: "#1A1A17", backgroundColor: "#FFFFFF" },
  header: { backgroundColor: "#072F1B", padding: 17, borderRadius: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { color: "#FFFFFF", fontSize: 15, fontWeight: 700 },
  tagline: { color: "#D0B17A", marginTop: 4, fontSize: 8 },
  title: { color: "#FFFFFF", fontSize: 13, fontWeight: 700, textAlign: "right" },
  gold: { color: "#D0B17A", fontSize: 8, marginTop: 4, textAlign: "right" },
  row: { flexDirection: "row", gap: 12 },
  block: { marginTop: 14, padding: 11, borderWidth: 1, borderColor: "#E7DFCF", borderRadius: 7 },
  sideBlock: { flex: 1 },
  label: { color: "#5C5A52", fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", marginBottom: 5 },
  bold: { fontSize: 9, fontWeight: 700, marginBottom: 3 },
  muted: { color: "#5C5A52", fontSize: 8, lineHeight: 1.4, marginTop: 2 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  table: { marginTop: 16, borderWidth: 1, borderColor: "#E7DFCF", borderRadius: 7, overflow: "hidden" },
  tableHead: { flexDirection: "row", backgroundColor: "#F6EFE2", paddingVertical: 7, paddingHorizontal: 7 },
  headText: { color: "#083928", fontSize: 7, fontWeight: 700 },
  line: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 7, borderTopWidth: 1, borderTopColor: "#E7DFCF", minHeight: 26 },
  product: { width: "34%", paddingRight: 5 },
  hsn: { width: "10%" },
  qty: { width: "8%", textAlign: "right" },
  rate: { width: "17%", textAlign: "right" },
  tax: { width: "12%", textAlign: "right" },
  amount: { width: "19%", textAlign: "right" },
  itemName: { fontSize: 8, fontWeight: 700, lineHeight: 1.25 },
  itemMeta: { color: "#5C5A52", fontSize: 7, marginTop: 2 },
  summaryWrap: { flexDirection: "row", gap: 12, marginTop: 14, alignItems: "flex-start" },
  notes: { flex: 1, padding: 10, backgroundColor: "#F6EFE2", borderRadius: 7 },
  totals: { width: 215, padding: 10, borderWidth: 1, borderColor: "#E7DFCF", borderRadius: 7 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 3 },
  totalLabel: { color: "#5C5A52", fontSize: 8 },
  totalValue: { fontSize: 8, textAlign: "right" },
  grand: { borderTopWidth: 1, borderTopColor: "#E7DFCF", marginTop: 5, paddingTop: 7 },
  grandText: { color: "#083928", fontSize: 11, fontWeight: 700 },
  words: { color: "#083928", fontSize: 8, lineHeight: 1.4, marginTop: 5 },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, borderTopWidth: 1, borderTopColor: "#E7DFCF", paddingTop: 7, flexDirection: "row", justifyContent: "space-between" },
  footerText: { color: "#5C5A52", fontSize: 7 },
});

const money = (value: number) => `INR ${Math.round(value).toLocaleString("en-IN")}`;

function InvoicePage({ invoice }: { invoice: InvoiceSnapshot }) {
  const gst = invoice.documentTitle === "Tax invoice";
  return <Page size="A4" style={styles.page} wrap>
    <View style={styles.header}>
      <View><Text style={styles.brand}>{invoice.seller.legalName}</Text><Text style={styles.tagline}>Wood-pressed in Bijainagar, Rajasthan</Text></View>
      <View><Text style={styles.title}>{invoice.documentTitle}</Text><Text style={styles.gold}>{invoice.invoiceNo}</Text></View>
    </View>

    <View style={styles.row}>
      <View style={[styles.block, styles.sideBlock]}>
        <Text style={styles.label}>Seller</Text>
        <Text style={styles.bold}>{invoice.seller.legalName}</Text>
        <Text style={styles.muted}>{invoice.seller.address}</Text>
        {invoice.seller.gstin && <Text style={styles.muted}>GSTIN: {invoice.seller.gstin}</Text>}
        <Text style={styles.muted}>FSSAI: {invoice.seller.fssai}</Text>
        <Text style={styles.muted}>{invoice.seller.phone}  |  {invoice.seller.email}</Text>
      </View>
      <View style={[styles.block, styles.sideBlock]}>
        <Text style={styles.label}>Invoice details</Text>
        <View style={styles.metaRow}><Text>Invoice date</Text><Text>{invoice.invoiceDate}</Text></View>
        <View style={styles.metaRow}><Text>Financial year</Text><Text>{invoice.financialYear}</Text></View>
        <View style={styles.metaRow}><Text>Place of supply</Text><Text>{invoice.supplyState}</Text></View>
        <View style={styles.metaRow}><Text>Supply type</Text><Text>{invoice.intraState ? "CGST + SGST" : "IGST"}</Text></View>
      </View>
    </View>

    <View style={styles.block}>
      <Text style={styles.label}>Bill to</Text>
      <Text style={styles.bold}>{invoice.buyer.name}</Text>
      <Text style={styles.muted}>{invoice.buyer.address}</Text>
      <Text style={styles.muted}>Phone: {invoice.buyer.phone}{invoice.buyer.email ? `  |  ${invoice.buyer.email}` : ""}</Text>
      <Text style={styles.muted}>State: {invoice.buyer.state}  |  PIN: {invoice.buyer.pincode}</Text>
    </View>

    <View style={styles.table}>
      <View style={styles.tableHead}>
        <Text style={[styles.headText, styles.product]}>Item</Text>
        <Text style={[styles.headText, styles.hsn]}>{gst ? "HSN" : "Code"}</Text>
        <Text style={[styles.headText, styles.qty]}>Qty</Text>
        <Text style={[styles.headText, styles.rate]}>Taxable value</Text>
        <Text style={[styles.headText, styles.tax]}>{gst ? "GST" : "Rate"}</Text>
        <Text style={[styles.headText, styles.amount]}>Amount</Text>
      </View>
      {invoice.lines.map((line, index) => <View key={`${line.sku ?? line.title}-${index}`} style={styles.line} wrap={false}>
        <View style={styles.product}><Text style={styles.itemName}>{line.title}</Text><Text style={styles.itemMeta}>{line.size}  |  Unit {money(line.unitPrice)}{line.sku ? `  |  SKU ${line.sku}` : ""}</Text></View>
        <Text style={[styles.muted, styles.hsn]}>{gst ? line.hsn ?? "-" : "-"}</Text>
        <Text style={[styles.muted, styles.qty]}>{line.quantity}</Text>
        <Text style={[styles.muted, styles.rate]}>{money(line.taxableValue)}</Text>
        <Text style={[styles.muted, styles.tax]}>{gst ? `${line.gstRate ?? 0}%` : "-"}</Text>
        <Text style={[styles.muted, styles.amount]}>{money(line.lineTotal)}</Text>
      </View>)}
    </View>

    <View style={styles.summaryWrap}>
      <View style={styles.notes}>
        {gst && <>
          <Text style={styles.label}>Tax summary</Text>
          {invoice.intraState
            ? <><Text style={styles.muted}>CGST: {money(invoice.lines.reduce((sum, line) => sum + line.cgst, 0))}</Text><Text style={styles.muted}>SGST: {money(invoice.lines.reduce((sum, line) => sum + line.sgst, 0))}</Text></>
            : <Text style={styles.muted}>IGST: {money(invoice.lines.reduce((sum, line) => sum + line.igst, 0))}</Text>}
          <Text style={styles.muted}>Prices {invoice.pricesIncludeGst ? "include" : "exclude"} GST</Text>
        </>}
        <Text style={styles.label}>{gst ? "Amount in words" : "Bill of supply"}</Text>
        <Text style={styles.words}>{invoice.amountInWords}</Text>
      </View>
      <View style={styles.totals}>
        <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>{money(invoice.subtotal)}</Text></View>
        {invoice.discount > 0 && <View style={styles.totalRow}><Text style={styles.totalLabel}>Discount</Text><Text style={styles.totalValue}>- {money(invoice.discount)}</Text></View>}
        {gst && <View style={styles.totalRow}><Text style={styles.totalLabel}>GST</Text><Text style={styles.totalValue}>{money(invoice.taxTotal)}</Text></View>}
        <View style={styles.totalRow}><Text style={styles.totalLabel}>Shipping</Text><Text style={styles.totalValue}>{invoice.shipping ? money(invoice.shipping) : "Free"}</Text></View>
        {invoice.codFee > 0 && <View style={styles.totalRow}><Text style={styles.totalLabel}>COD fee</Text><Text style={styles.totalValue}>{money(invoice.codFee)}</Text></View>}
        <View style={[styles.totalRow, styles.grand]}><Text style={styles.grandText}>Total</Text><Text style={styles.grandText}>{money(invoice.total)}</Text></View>
      </View>
    </View>

    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Thank you for choosing Swadeshi Mahadev Products</Text>
      <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${invoice.invoiceNo}  |  Page ${pageNumber} of ${totalPages}`} />
    </View>
  </Page>;
}

export function InvoiceDocument({ invoices }: { invoices: InvoiceSnapshot[] }) {
  return <Document title={invoices.length === 1 ? invoices[0].invoiceNo : "Swadeshi Mahadev invoices"} author="Swadeshi Mahadev Products">
    {invoices.map((invoice) => <InvoicePage key={invoice.invoiceNo} invoice={invoice} />)}
  </Document>;
}
