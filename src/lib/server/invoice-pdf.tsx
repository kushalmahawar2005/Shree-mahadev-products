import "server-only";
import { join } from "node:path";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { taxConfig } from "@/config/tax";
import type { InvoiceSnapshot } from "./invoices";

/**
 * Tax invoice / bill of supply / credit note PDF. Layout follows the familiar marketplace invoice
 * (Amazon-style): title + "Original for Recipient", seller left / addresses right, one fully ruled
 * item table with the tax split per line, amount in words, signatory, then payment details.
 * Brand only as accents (forest + gold rules, cream table head) so it prints well in black and white.
 */

const ink = "#1A1A17";
const muted = "#55524A";
const rule = "#BDB4A0";
const soft = "#F6EFE2";
const forest = "#0E3B26";
const gold = "#C9A45C";

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 48, paddingHorizontal: 32, fontFamily: "Helvetica", fontSize: 8, color: ink, backgroundColor: "#FFFFFF" },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  logo: { width: 44, height: 44 },
  brand: { color: forest, fontSize: 14, fontFamily: "Helvetica-Bold" },
  tagline: { color: muted, fontSize: 7.5, marginTop: 2 },
  title: { fontSize: 11.5, fontFamily: "Helvetica-Bold", textAlign: "right" },
  subTitle: { color: muted, fontSize: 7.5, textAlign: "right", marginTop: 2 },
  ruleForest: { height: 2, backgroundColor: forest, marginTop: 10 },
  ruleGold: { height: 1, backgroundColor: gold, marginTop: 1.5, marginBottom: 12 },

  twoCol: { flexDirection: "row", justifyContent: "space-between", gap: 24 },
  colLeft: { flex: 1 },
  colRight: { flex: 1, alignItems: "flex-end" },
  heading: { fontSize: 8.5, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  text: { fontSize: 8, lineHeight: 1.4 },
  textRight: { fontSize: 8, lineHeight: 1.4, textAlign: "right" },
  kv: { fontSize: 8, lineHeight: 1.5 },
  kvRight: { fontSize: 8, lineHeight: 1.5, textAlign: "right" },
  b: { fontFamily: "Helvetica-Bold" },
  gap: { height: 9 },

  table: { marginTop: 12, borderWidth: 0.8, borderColor: rule },
  tr: { flexDirection: "row", borderBottomWidth: 0.8, borderBottomColor: rule },
  trLast: { flexDirection: "row" },
  th: { backgroundColor: soft, paddingVertical: 5, paddingHorizontal: 4, borderRightWidth: 0.8, borderRightColor: rule, fontSize: 7, fontFamily: "Helvetica-Bold", color: forest },
  td: { paddingVertical: 5, paddingHorizontal: 4, borderRightWidth: 0.8, borderRightColor: rule, fontSize: 7.6 },
  itemName: { fontSize: 7.8, fontFamily: "Helvetica-Bold", lineHeight: 1.3 },
  itemMeta: { color: muted, fontSize: 6.8, marginTop: 1.5, lineHeight: 1.3 },
  totalCell: { paddingVertical: 5, paddingHorizontal: 4, fontSize: 8, fontFamily: "Helvetica-Bold" },
  words: { paddingVertical: 6, paddingHorizontal: 6 },
  signRow: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 8, paddingHorizontal: 8 },
  signBox: { alignItems: "flex-end" },
  signImg: { height: 34, marginVertical: 4, objectFit: "contain" },

  note: { marginTop: 6, fontSize: 7.2, color: muted },
  payTable: { marginTop: 10, borderWidth: 0.8, borderColor: rule },

  thanks: { marginTop: 14, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: soft, borderLeftWidth: 3, borderLeftColor: forest, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  thanksTitle: { color: forest, fontSize: 9, fontFamily: "Helvetica-Bold" },
  thanksText: { color: muted, fontSize: 7.2, marginTop: 2 },

  footer: { position: "absolute", bottom: 20, left: 32, right: 32, borderTopWidth: 0.8, borderTopColor: rule, paddingTop: 6, flexDirection: "row", justifyContent: "space-between" },
  footerText: { color: muted, fontSize: 6.6 },
});

/** Item table columns (sum 100%). */
const W = { sno: "5%", desc: "27%", unit: "9%", disc: "8%", qty: "5%", net: "10%", rate: "7%", type: "7%", tax: "10%", total: "12%" } as const;
const R = { textAlign: "right" as const };
type Style = Exclude<NonNullable<React.ComponentProps<typeof View>["style"]>, readonly unknown[] | unknown[]>;

const num = (value: number) => value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** The built-in PDF fonts have no ₹ glyph (it prints as a stray mark), so amounts use "Rs.". */
const inr = (value: number) => `Rs. ${num(value)}`;

/** Files under /public are read from disk; anything else is passed through as a URL. */
function asset(src: string | undefined) {
  if (!src) return null;
  return src.startsWith("/") ? join(process.cwd(), "public", src) : src;
}

const sameAddress = (a: InvoiceSnapshot["billTo"], b: InvoiceSnapshot["shipTo"]) =>
  a.name === b.name && a.address === b.address && a.pincode === b.pincode;

function Address({ title, party, right }: { title: string; party: InvoiceSnapshot["billTo"]; right?: boolean }) {
  const t = right ? styles.textRight : styles.text;
  return (
    <View style={right ? { alignItems: "flex-end" } : undefined}>
      <Text style={[styles.heading, right ? R : {}]}>{title}</Text>
      <Text style={[t, styles.b]}>{party.name}</Text>
      <Text style={t}>{party.address}</Text>
      <Text style={t}>State/UT Code: {party.stateCode || "-"}</Text>
      <Text style={t}>Phone: {party.phone}</Text>
      {party.gstin ? <Text style={t}>GSTIN: {party.gstin}</Text> : null}
    </View>
  );
}

function KV({ k, v, right }: { k: string; v: string; right?: boolean }) {
  if (!v) return null;
  return (
    <Text style={right ? styles.kvRight : styles.kv}>
      <Text style={styles.b}>{k}: </Text>
      {v}
    </Text>
  );
}

function Cell({ w, children, style, last }: { w: string; children: React.ReactNode; style?: Style; last?: boolean }) {
  return <View style={[styles.td, { width: w }, last ? { borderRightWidth: 0 } : {}, style ?? {}]}>{children}</View>;
}

function DocumentPage({ doc }: { doc: InvoiceSnapshot }) {
  const gst = doc.gstRegistered;
  const credit = doc.kind === "credit_note";
  const logo = asset(taxConfig.logoPath);
  const signature = asset(doc.signatureImageUrl);
  const t = doc.totals;
  const title = credit ? "Credit Note" : gst ? "Tax Invoice/Bill of Supply/Cash Memo" : "Bill of Supply";
  const shipSame = sameAddress(doc.billTo, doc.shipTo);
  const place = `${doc.placeOfSupply.state}${doc.placeOfSupply.code ? ` (${doc.placeOfSupply.code})` : ""}`;

  return (
    <Page size="A4" style={styles.page} wrap>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
          {logo ? <Image src={logo} style={styles.logo} /> : null}
          <View>
            <Text style={styles.brand}>{doc.seller.legalName}</Text>
            <Text style={styles.tagline}>Wood-pressed kachi ghani oils · Raw honey · Natural sweeteners</Text>
          </View>
        </View>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subTitle}>(Original for Recipient)</Text>
          {!gst && !credit ? <Text style={styles.subTitle}>Seller not registered under GST</Text> : null}
        </View>
      </View>
      <View style={styles.ruleForest} />
      <View style={styles.ruleGold} />

      {/* Sold by  |  Billing + shipping */}
      <View style={styles.twoCol}>
        <View style={styles.colLeft}>
          <Text style={styles.heading}>Sold By:</Text>
          <Text style={[styles.text, styles.b]}>{doc.seller.legalName}</Text>
          <Text style={styles.text}>{doc.seller.address}</Text>
          <Text style={styles.text}>
            {doc.seller.state} ({doc.seller.stateCode})
          </Text>
          <View style={styles.gap} />
          <KV k="GST Registration No" v={doc.seller.gstin} />
          <KV k="Customer care" v={[doc.seller.phone, doc.seller.email].filter(Boolean).join("  ·  ")} />
        </View>
        <View style={styles.colRight}>
          <Address title="Billing Address:" party={doc.billTo} right />
          <View style={styles.gap} />
          {shipSame ? (
            <Text style={styles.textRight}>
              <Text style={styles.b}>Shipping Address: </Text>Same as billing address
            </Text>
          ) : (
            <Address title="Shipping Address:" party={doc.shipTo} right />
          )}
          <View style={styles.gap} />
          <KV k="Place of supply" v={place} right />
          <KV k="Place of delivery" v={`${doc.shipTo.state}${doc.shipTo.stateCode ? ` (${doc.shipTo.stateCode})` : ""}`} right />
        </View>
      </View>

      {/* Order  |  Invoice numbers */}
      <View style={[styles.twoCol, { marginTop: 10 }]}>
        <View style={styles.colLeft}>
          <KV k="Order Number" v={doc.order.orderNo} />
          <KV k="Order Date" v={doc.order.orderDate} />
        </View>
        <View style={styles.colRight}>
          <KV k={credit ? "Credit Note Number" : "Invoice Number"} v={doc.invoiceNo} right />
          <KV k={credit ? "Credit Note Date" : "Invoice Date"} v={doc.invoiceDateText} right />
          {credit && doc.against ? (
            <>
              <KV k="Against Invoice" v={`${doc.against.invoiceNo} (${doc.against.invoiceDate})`} right />
              <KV k="Reason" v={doc.against.reason} right />
            </>
          ) : null}
        </View>
      </View>

      {/* Item table */}
      <View style={styles.table}>
        <View style={styles.tr} fixed>
          <Text style={[styles.th, { width: W.sno }]}>Sl. No</Text>
          <Text style={[styles.th, { width: W.desc }]}>Description</Text>
          <Text style={[styles.th, { width: W.unit }, R]}>Unit Price</Text>
          <Text style={[styles.th, { width: W.disc }, R]}>Discount</Text>
          <Text style={[styles.th, { width: W.qty }, R]}>Qty</Text>
          <Text style={[styles.th, { width: W.net }, R]}>Net Amount</Text>
          <Text style={[styles.th, { width: W.rate }, R]}>Tax Rate</Text>
          <Text style={[styles.th, { width: W.type }]}>Tax Type</Text>
          <Text style={[styles.th, { width: W.tax }, R]}>Tax Amount</Text>
          <Text style={[styles.th, { width: W.total, borderRightWidth: 0 }, R]}>Total Amount</Text>
        </View>

        {doc.lines.map((l, i) => {
          const split = gst && doc.intraState;
          const rates = !gst ? ["-"] : split ? [`${l.gstRate / 2}%`, `${l.gstRate / 2}%`] : [`${l.gstRate}%`];
          const types = !gst ? ["-"] : split ? ["CGST", "SGST"] : ["IGST"];
          const amounts = !gst ? ["-"] : split ? [num(l.cgst), num(l.sgst)] : [num(l.igst)];
          return (
            <View key={`${l.kind}-${l.sku ?? l.title}-${i}`} style={styles.tr} wrap={false}>
              <Cell w={W.sno}>
                <Text>{i + 1}</Text>
              </Cell>
              <Cell w={W.desc}>
                <Text style={styles.itemName}>
                  {l.title}
                  {l.size ? ` (${l.size})` : ""}
                </Text>
                <Text style={styles.itemMeta}>{[l.hsn ? `HSN: ${l.hsn}` : "", l.sku ? `SKU: ${l.sku}` : ""].filter(Boolean).join("   ")}</Text>
              </Cell>
              <Cell w={W.unit} style={R}>
                <Text style={R}>{credit ? "-" : inr(l.unitPrice)}</Text>
              </Cell>
              <Cell w={W.disc}>
                <Text style={R}>{l.discount ? `-${inr(l.discount)}` : "-"}</Text>
              </Cell>
              <Cell w={W.qty}>
                <Text style={R}>{credit ? "-" : l.quantity}</Text>
              </Cell>
              <Cell w={W.net}>
                <Text style={R}>{inr(l.taxableValue)}</Text>
              </Cell>
              <Cell w={W.rate}>
                {rates.map((r, k) => (
                  <Text key={k} style={[R, k ? { marginTop: 3 } : {}]}>
                    {r}
                  </Text>
                ))}
              </Cell>
              <Cell w={W.type}>
                {types.map((r, k) => (
                  <Text key={k} style={k ? { marginTop: 3 } : undefined}>
                    {r}
                  </Text>
                ))}
              </Cell>
              <Cell w={W.tax}>
                {amounts.map((r, k) => (
                  <Text key={k} style={[R, k ? { marginTop: 3 } : {}]}>
                    {r === "-" ? r : `Rs. ${r}`}
                  </Text>
                ))}
              </Cell>
              <Cell w={W.total} last>
                <Text style={[R, styles.b]}>{inr(l.lineTotal)}</Text>
              </Cell>
            </View>
          );
        })}

        {t.roundOff ? (
          <View style={styles.tr}>
            <Text style={[styles.totalCell, { width: "78%", fontFamily: "Helvetica" }]}>Round off</Text>
            <Text style={[styles.totalCell, { width: "22%", fontFamily: "Helvetica" }, R]}>
              {t.roundOff > 0 ? "+" : "-"}Rs. {num(Math.abs(t.roundOff))}
            </Text>
          </View>
        ) : null}

        {/* TOTAL row: tax total under Tax Amount, grand total under Total Amount */}
        <View style={[styles.tr, { backgroundColor: soft }]} wrap={false}>
          <Text style={[styles.totalCell, { width: "78%", borderRightWidth: 0.8, borderRightColor: rule }]}>{credit ? "CREDIT TOTAL:" : "TOTAL:"}</Text>
          <Text style={[styles.totalCell, { width: W.tax, borderRightWidth: 0.8, borderRightColor: rule }, R]}>{gst ? inr(t.tax) : "-"}</Text>
          <Text style={[styles.totalCell, { width: W.total, color: forest }, R]}>{inr(t.grandTotal)}</Text>
        </View>

        <View style={styles.tr} wrap={false}>
          <View style={styles.words}>
            <Text style={styles.b}>Amount in Words:</Text>
            <Text style={{ marginTop: 2, fontFamily: "Helvetica-Bold", color: forest }}>{doc.amountInWords}</Text>
          </View>
        </View>

        <View style={[styles.trLast, styles.signRow]} wrap={false}>
          <View style={styles.signBox}>
            <Text style={styles.b}>For {doc.seller.legalName}:</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            {signature ? <Image src={signature} style={styles.signImg} /> : <View style={{ height: 34 }} />}
            <Text style={styles.b}>Authorized Signatory</Text>
          </View>
        </View>
      </View>

      <Text style={styles.note}>
        Whether tax is payable under reverse charge - No.{gst ? (doc.pricesIncludeGst ? "  Prices are inclusive of GST." : "  GST added to listed prices.") : ""}
      </Text>

      {/* Payment details (invoices only) */}
      {!credit && doc.order.paymentMode ? (
        <View style={styles.payTable} wrap={false}>
          <View style={styles.tr}>
            <Text style={[styles.th, { width: "44%" }]}>Payment Transaction ID</Text>
            <Text style={[styles.th, { width: "20%" }, R]}>Invoice Value</Text>
            <Text style={[styles.th, { width: "36%", borderRightWidth: 0 }]}>Mode of Payment</Text>
          </View>
          <View style={styles.trLast}>
            <Text style={[styles.td, { width: "44%" }]}>{doc.order.paymentRef || "-"}</Text>
            <Text style={[styles.td, { width: "20%" }, R]}>{inr(t.grandTotal)}</Text>
            <Text style={[styles.td, { width: "36%", borderRightWidth: 0 }]}>{doc.order.paymentMode}</Text>
          </View>
        </View>
      ) : null}

      {/* Declaration + thank-you strip */}
      <Text style={[styles.note, { marginTop: 10, lineHeight: 1.4 }]}>
        Declaration: {doc.declaration} This is a computer-generated {credit ? "credit note" : "invoice"} and does not require a physical signature.
      </Text>
      <View style={styles.thanks} wrap={false}>
        <View>
          <Text style={styles.thanksTitle}>Thank you for choosing {doc.seller.legalName}</Text>
          <Text style={styles.thanksText}>Slow-pressed in our wooden ghani in Bijainagar, Rajasthan. Seed to bottle, for your family.</Text>
        </View>
        <Text style={[styles.thanksText, R]}>
          Questions about your order?{"\n"}
          {[doc.seller.phone, doc.seller.email].filter(Boolean).join("  ·  ")}
        </Text>
      </View>

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>{doc.seller.legalName}</Text>
        <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `${doc.invoiceNo}  |  Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  );
}

export function InvoiceDocument({ invoices }: { invoices: InvoiceSnapshot[] }) {
  return (
    <Document title={invoices.length === 1 ? invoices[0].invoiceNo : "Swadeshi Mahadev invoices"} author="Swadeshi Mahadev Products">
      {invoices.map((doc) => (
        <DocumentPage key={doc.invoiceNo} doc={doc} />
      ))}
    </Document>
  );
}
