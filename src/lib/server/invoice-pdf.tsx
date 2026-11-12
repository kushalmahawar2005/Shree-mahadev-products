import "server-only";
import { join } from "node:path";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { taxConfig } from "@/config/tax";
import type { InvoiceSnapshot } from "./invoices";

const ink = "#1A1A17";
const muted = "#5C5A52";
const line = "#E7DFCF";
const forest = "#072F1B";
const gold = "#D0B17A";

const styles = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 46, paddingHorizontal: 30, fontFamily: "Helvetica", fontSize: 8, color: ink, backgroundColor: "#FFFFFF" },
  header: { backgroundColor: forest, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF" },
  brand: { color: "#FFFFFF", fontSize: 13, fontFamily: "Helvetica-Bold" },
  tagline: { color: gold, marginTop: 3, fontSize: 7.5 },
  title: { color: "#FFFFFF", fontSize: 14, fontFamily: "Helvetica-Bold", textAlign: "right", letterSpacing: 1 },
  goldRight: { color: gold, fontSize: 8, marginTop: 3, textAlign: "right" },
  row: { flexDirection: "row", gap: 10 },
  block: { marginTop: 10, padding: 9, borderWidth: 1, borderColor: line, borderRadius: 6, flex: 1 },
  label: { color: muted, fontSize: 6.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 },
  bold: { fontSize: 8.5, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  muted: { color: muted, fontSize: 7.5, lineHeight: 1.35, marginTop: 1 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 2.5 },
  metaKey: { color: muted, fontSize: 7.5 },
  metaVal: { fontSize: 7.5, fontFamily: "Helvetica-Bold", textAlign: "right", maxWidth: "62%" },
  table: { marginTop: 12, borderWidth: 1, borderColor: line, borderRadius: 6 },
  head: { flexDirection: "row", backgroundColor: "#F6EFE2", paddingVertical: 5, paddingHorizontal: 5 },
  headText: { color: "#083928", fontSize: 6.5, fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 5, borderTopWidth: 1, borderTopColor: line },
  cell: { fontSize: 7.2 },
  itemName: { fontSize: 7.5, fontFamily: "Helvetica-Bold", lineHeight: 1.25 },
  itemMeta: { color: muted, fontSize: 6.5, marginTop: 1.5 },
  summary: { flexDirection: "row", gap: 10, marginTop: 10, alignItems: "flex-start" },
  left: { flex: 1 },
  taxTable: { borderWidth: 1, borderColor: line, borderRadius: 6 },
  words: { marginTop: 8, padding: 8, backgroundColor: "#F6EFE2", borderRadius: 6 },
  wordsText: { color: "#083928", fontSize: 7.5, lineHeight: 1.4, fontFamily: "Helvetica-Bold" },
  totals: { width: 200, padding: 9, borderWidth: 1, borderColor: line, borderRadius: 6 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 2 },
  totalKey: { color: muted, fontSize: 7.5 },
  totalVal: { fontSize: 7.5, textAlign: "right" },
  grand: { borderTopWidth: 1, borderTopColor: line, marginTop: 4, paddingTop: 5 },
  grandText: { color: "#083928", fontSize: 10, fontFamily: "Helvetica-Bold" },
  closing: { flexDirection: "row", gap: 10, marginTop: 12, alignItems: "flex-end" },
  declaration: { flex: 1, color: muted, fontSize: 6.8, lineHeight: 1.4 },
  sign: { width: 200, alignItems: "flex-end" },
  signImg: { height: 34, marginBottom: 3, objectFit: "contain" },
  signLine: { borderTopWidth: 1, borderTopColor: ink, paddingTop: 3, width: 150, textAlign: "center", fontSize: 7 },
  footer: { position: "absolute", bottom: 18, left: 30, right: 30, borderTopWidth: 1, borderTopColor: line, paddingTop: 6, flexDirection: "row", justifyContent: "space-between" },
  footerText: { color: muted, fontSize: 6.5 },
});

const cols = {
  sno: { width: "4%" }, desc: { width: "26%", paddingRight: 4 }, hsn: { width: "8%" }, qty: { width: "5%", textAlign: "right" as const },
  unit: { width: "9%", textAlign: "right" as const }, disc: { width: "8%", textAlign: "right" as const }, taxable: { width: "10%", textAlign: "right" as const },
  rate: { width: "6%", textAlign: "right" as const }, tax: { width: "11%", textAlign: "right" as const }, total: { width: "13%", textAlign: "right" as const },
};

const num = (value: number) => value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (value: number) => `INR ${num(value)}`;

/** Files under /public are read from disk; anything else is passed through as a URL. */
function asset(src: string | undefined) {
  if (!src) return null;
  return src.startsWith("/") ? join(process.cwd(), "public", src) : src;
}

function Meta({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return <View style={styles.metaRow}><Text style={styles.metaKey}>{k}</Text><Text style={styles.metaVal}>{v}</Text></View>;
}

function PartyBlock({ title, party, showGstin }: { title: string; party: InvoiceSnapshot["billTo"]; showGstin: boolean }) {
  return <View style={styles.block}>
    <Text style={styles.label}>{title}</Text>
    <Text style={styles.bold}>{party.name}</Text>
    <Text style={styles.muted}>{party.address}</Text>
    <Text style={styles.muted}>Phone: {party.phone}{party.email ? `  |  ${party.email}` : ""}</Text>
    <Text style={styles.muted}>State: {party.state}{party.stateCode ? ` (${party.stateCode})` : ""}</Text>
    {showGstin && party.gstin ? <Text style={styles.muted}>GSTIN: {party.gstin}</Text> : null}
  </View>;
}

function rateSummary(doc: InvoiceSnapshot) {
  const map = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number }>();
  for (const l of doc.lines) {
    const row = map.get(l.gstRate) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    row.taxable += l.taxableValue; row.cgst += l.cgst; row.sgst += l.sgst; row.igst += l.igst;
    map.set(l.gstRate, row);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

function DocumentPage({ doc }: { doc: InvoiceSnapshot }) {
  const gst = doc.gstRegistered;
  const credit = doc.kind === "credit_note";
  const logo = asset(taxConfig.logoPath);
  const signature = asset(doc.signatureImageUrl);
  const title = credit ? "CREDIT NOTE" : doc.documentTitle.toUpperCase();
  const t = doc.totals;
  return <Page size="A4" style={styles.page} wrap>
    <View style={styles.header}>
      <View style={styles.brandRow}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
        {logo ? <Image src={logo} style={styles.logo} /> : null}
        <View><Text style={styles.brand}>{doc.seller.legalName}</Text><Text style={styles.tagline}>Wood-pressed in Bijainagar, Rajasthan</Text></View>
      </View>
      <View><Text style={styles.title}>{title}</Text><Text style={styles.goldRight}>{doc.invoiceNo}</Text>{!gst && !credit ? <Text style={styles.goldRight}>Seller not registered under GST</Text> : null}</View>
    </View>

    <View style={styles.row}>
      <View style={styles.block}>
        <Text style={styles.label}>Sold by</Text>
        <Text style={styles.bold}>{doc.seller.legalName}</Text>
        <Text style={styles.muted}>{doc.seller.address}</Text>
        {doc.seller.gstin ? <Text style={styles.muted}>GSTIN: {doc.seller.gstin}</Text> : null}
        <Text style={styles.muted}>State: {doc.seller.state} ({doc.seller.stateCode})</Text>
        <Text style={styles.muted}>FSSAI Lic. No.: {doc.seller.fssai}</Text>
        <Text style={styles.muted}>{doc.seller.phone}  |  {doc.seller.email}</Text>
      </View>
      <View style={styles.block}>
        <Text style={styles.label}>{credit ? "Credit note details" : "Invoice details"}</Text>
        <Meta k={credit ? "Credit note no." : "Invoice no."} v={doc.invoiceNo} />
        <Meta k={credit ? "Credit note date" : "Invoice date"} v={doc.invoiceDateText} />
        {credit && doc.against ? <><Meta k="Against invoice" v={doc.against.invoiceNo} /><Meta k="Invoice date" v={doc.against.invoiceDate} /><Meta k="Reason" v={doc.against.reason} /></> : null}
        <Meta k="Order no." v={doc.order.orderNo} />
        <Meta k="Order date" v={doc.order.orderDate} />
        <Meta k="Place of supply" v={`${doc.placeOfSupply.state}${doc.placeOfSupply.code ? ` (${doc.placeOfSupply.code})` : ""}`} />
        {gst ? <Meta k="Tax type" v={doc.intraState ? "CGST + SGST" : "IGST"} /> : null}
      </View>
    </View>

    <View style={styles.row}>
      <PartyBlock title="Bill to" party={doc.billTo} showGstin />
      <PartyBlock title="Ship to" party={doc.shipTo} showGstin={false} />
    </View>

    <View style={styles.table}>
      <View style={styles.head} fixed>
        <Text style={[styles.headText, cols.sno]}>#</Text>
        <Text style={[styles.headText, cols.desc]}>Description</Text>
        <Text style={[styles.headText, cols.hsn]}>HSN/SAC</Text>
        <Text style={[styles.headText, cols.qty]}>Qty</Text>
        <Text style={[styles.headText, cols.unit]}>Unit price</Text>
        <Text style={[styles.headText, cols.disc]}>Discount</Text>
        <Text style={[styles.headText, cols.taxable]}>Taxable</Text>
        <Text style={[styles.headText, cols.rate]}>GST</Text>
        <Text style={[styles.headText, cols.tax]}>Tax amt</Text>
        <Text style={[styles.headText, cols.total]}>Total</Text>
      </View>
      {doc.lines.map((l, i) => <View key={`${l.kind}-${l.sku ?? l.title}-${i}`} style={styles.tr} wrap={false}>
        <Text style={[styles.cell, cols.sno]}>{i + 1}</Text>
        <View style={cols.desc}><Text style={styles.itemName}>{l.title}</Text>{l.size || l.sku ? <Text style={styles.itemMeta}>{[l.size, l.sku && `SKU ${l.sku}`].filter(Boolean).join("  |  ")}</Text> : null}</View>
        <Text style={[styles.cell, cols.hsn]}>{l.hsn ?? "-"}</Text>
        <Text style={[styles.cell, cols.qty]}>{credit ? "-" : l.quantity}</Text>
        <Text style={[styles.cell, cols.unit]}>{credit ? "-" : num(l.unitPrice)}</Text>
        <Text style={[styles.cell, cols.disc]}>{l.discount ? num(l.discount) : "-"}</Text>
        <Text style={[styles.cell, cols.taxable]}>{num(l.taxableValue)}</Text>
        <Text style={[styles.cell, cols.rate]}>{gst ? `${l.gstRate}%` : "-"}</Text>
        <Text style={[styles.cell, cols.tax]}>{gst ? num(l.taxAmount) : "-"}</Text>
        <Text style={[styles.cell, cols.total]}>{num(l.lineTotal)}</Text>
      </View>)}
    </View>

    <View style={styles.summary} wrap={false}>
      <View style={styles.left}>
        {gst ? <View style={styles.taxTable}>
          <View style={styles.head}>
            <Text style={[styles.headText, { width: "16%" }]}>GST rate</Text>
            <Text style={[styles.headText, { width: "28%", textAlign: "right" }]}>Taxable value</Text>
            {doc.intraState
              ? <><Text style={[styles.headText, { width: "28%", textAlign: "right" }]}>CGST</Text><Text style={[styles.headText, { width: "28%", textAlign: "right" }]}>SGST</Text></>
              : <Text style={[styles.headText, { width: "56%", textAlign: "right" }]}>IGST</Text>}
          </View>
          {rateSummary(doc).map(([rate, r]) => <View key={rate} style={styles.tr}>
            <Text style={[styles.cell, { width: "16%" }]}>{rate}%</Text>
            <Text style={[styles.cell, { width: "28%", textAlign: "right" }]}>{num(r.taxable)}</Text>
            {doc.intraState
              ? <><Text style={[styles.cell, { width: "28%", textAlign: "right" }]}>{num(r.cgst)} ({rate / 2}%)</Text><Text style={[styles.cell, { width: "28%", textAlign: "right" }]}>{num(r.sgst)} ({rate / 2}%)</Text></>
              : <Text style={[styles.cell, { width: "56%", textAlign: "right" }]}>{num(r.igst)} ({rate}%)</Text>}
          </View>)}
        </View> : null}
        <View style={styles.words}>
          <Text style={styles.label}>Amount in words</Text>
          <Text style={styles.wordsText}>{doc.amountInWords}</Text>
        </View>
        {!credit && doc.order.paymentMode ? <View style={{ marginTop: 6 }}>
          <Meta k="Payment mode" v={doc.order.paymentMode} />
          <Meta k="Payment reference" v={doc.order.paymentRef} />
        </View> : null}
      </View>
      <View style={styles.totals}>
        <View style={styles.totalRow}><Text style={styles.totalKey}>Taxable value</Text><Text style={styles.totalVal}>{money(t.taxable)}</Text></View>
        {gst && doc.intraState ? <>
          <View style={styles.totalRow}><Text style={styles.totalKey}>CGST</Text><Text style={styles.totalVal}>{money(t.cgst)}</Text></View>
          <View style={styles.totalRow}><Text style={styles.totalKey}>SGST</Text><Text style={styles.totalVal}>{money(t.sgst)}</Text></View>
        </> : null}
        {gst && !doc.intraState ? <View style={styles.totalRow}><Text style={styles.totalKey}>IGST</Text><Text style={styles.totalVal}>{money(t.igst)}</Text></View> : null}
        {t.roundOff ? <View style={styles.totalRow}><Text style={styles.totalKey}>Round off</Text><Text style={styles.totalVal}>{t.roundOff > 0 ? "+" : "-"} {num(Math.abs(t.roundOff))}</Text></View> : null}
        <View style={[styles.totalRow, styles.grand]}><Text style={styles.grandText}>{credit ? "Credit total" : "Grand total"}</Text><Text style={styles.grandText}>{money(t.grandTotal)}</Text></View>
        {gst ? <Text style={[styles.muted, { marginTop: 4 }]}>{doc.pricesIncludeGst ? "Prices are inclusive of GST." : "GST added to listed prices."}</Text> : null}
      </View>
    </View>

    <View style={styles.closing} wrap={false}>
      <Text style={styles.declaration}>
        Declaration: {doc.declaration}{"\n"}
        This is a computer-generated {credit ? "credit note" : "invoice"} and does not require a physical signature.
      </Text>
      <View style={styles.sign}>
        <Text style={[styles.muted, { marginBottom: 4 }]}>For {doc.seller.legalName}</Text>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
        {signature ? <Image src={signature} style={styles.signImg} /> : <View style={{ height: 30 }} />}
        <Text style={styles.signLine}>Authorised signatory</Text>
      </View>
    </View>

    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Thank you for choosing {doc.seller.legalName}</Text>
      <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${doc.invoiceNo}  |  Page ${pageNumber} of ${totalPages}`} />
    </View>
  </Page>;
}

export function InvoiceDocument({ invoices }: { invoices: InvoiceSnapshot[] }) {
  return <Document title={invoices.length === 1 ? invoices[0].invoiceNo : "Swadeshi Mahadev invoices"} author="Swadeshi Mahadev Products">
    {invoices.map((doc) => <DocumentPage key={doc.invoiceNo} doc={doc} />)}
  </Document>;
}
