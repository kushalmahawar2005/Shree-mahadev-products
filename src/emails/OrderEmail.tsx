import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

export type EmailKind =
  | "order_placed"
  | "payment_received"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refund"
  | "store_new_order";

export type EmailOrder = {
  orderNo: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  paymentMethod: "cod" | "payu" | "offline";
  items: { title: string; size: string; qty: number; lineTotal: number }[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  shipping: number;
  codFee: number;
  total: number;
  orderUrl: string;
  reviewUrl: string;
  invoiceUrl: string;
  trackingPageUrl: string;
  courier?: string | null;
  awb?: string | null;
  trackingUrl?: string | null;
  refundAmount?: number;
  note?: string | null;
};

export type EmailBrand = {
  siteUrl: string;
  logoUrl: string;
  phone: string;
  whatsappUrl: string;
  supportHours: string;
  email: string;
  address: string;
  fssai: string;
};

const C = {
  forest: "#0C3C24",
  forestDeep: "#072F1B",
  mustard: "#B49024",
  khakiSoft: "#F6EFE2",
  ink: "#1A1A17",
  muted: "#5C5A52",
  line: "#E7DFCF",
};
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const COPY: Record<
  EmailKind,
  {
    preview: (o: EmailOrder) => string;
    heading: string;
    intro: (o: EmailOrder) => string;
    cta?: string;
  }
> = {
  order_placed: {
    preview: (o) =>
      `Order ${o.orderNo} placed. Pay ${inr(o.total)} in cash on delivery.`,
    heading: "Thank you! Your order is placed.",
    intro: () =>
      "We've got your order. Please keep the cash ready at delivery. We may call or WhatsApp you to confirm before we dispatch.",
    cta: "View your order",
  },
  payment_received: {
    preview: (o) =>
      `Payment received for ${o.orderNo}. We're getting it ready.`,
    heading: "Payment received. Thank you!",
    intro: (o) =>
      `We've received ${inr(o.total)} for order ${o.orderNo}. We'll pack it fresh and send the tracking details once it ships.`,
    cta: "View your order",
  },
  shipped: {
    preview: (o) =>
      `Order ${o.orderNo} is on its way${o.courier ? ` with ${o.courier}` : ""}.`,
    heading: "Your order is on its way",
    intro: (o) =>
      `Order ${o.orderNo} has been handed to ${o.courier ?? "our courier partner"}. You can track it any time.`,
    cta: "Track your order",
  },
  delivered: {
    preview: (o) => `Order ${o.orderNo} delivered. How was it?`,
    heading: "Delivered. We hope you love it.",
    intro: () =>
      "Your order has been delivered. Unrefined oil can look a little cloudy or settle in winter. That is normal. If anything is not right, just reply to this email or WhatsApp us.",
    cta: "Write a review",
  },
  cancelled: {
    preview: (o) => `Order ${o.orderNo} has been cancelled.`,
    heading: "Your order was cancelled",
    intro: (o) =>
      o.paymentMethod === "payu"
        ? "Your order has been cancelled. If you paid online, the refund goes back to your original payment method. Banks usually take a few working days."
        : o.paymentMethod === "offline"
          ? "Your order has been cancelled. Please contact us to arrange any refund for an offline payment."
          : "Your order has been cancelled. No payment is due.",
    cta: "View order",
  },
  refund: {
    preview: (o) =>
      `Refund of ${inr(o.refundAmount ?? o.total)} processed for ${o.orderNo}.`,
    heading: "Your refund is on its way",
    intro: (o) =>
      `We've processed a refund of ${inr(o.refundAmount ?? o.total)} for order ${o.orderNo}. It should reach your original payment method in a few working days, depending on your bank.`,
    cta: "View order",
  },
  store_new_order: {
    preview: (o) =>
      `New order ${o.orderNo} – ${inr(o.total)} – ${o.paymentMethod === "cod" ? "COD" : o.paymentMethod === "offline" ? "paid offline" : "paid online"}`,
    heading: "New order",
    intro: (o) =>
      `${o.name} placed ${o.orderNo} for ${inr(o.total)} (${o.paymentMethod === "cod" ? "cash on delivery" : o.paymentMethod === "offline" ? "paid offline" : "paid online via PayU"}).`,
    cta: "Open in admin",
  },
};

export function subjectFor(kind: EmailKind, o: EmailOrder) {
  switch (kind) {
    case "order_placed":
      return `Order ${o.orderNo} placed – Swadeshi Mahadev`;
    case "payment_received":
      return `Payment received – order ${o.orderNo}`;
    case "shipped":
      return `Shipped: your order ${o.orderNo} is on its way`;
    case "delivered":
      return `Delivered: order ${o.orderNo}`;
    case "cancelled":
      return `Order ${o.orderNo} cancelled`;
    case "refund":
      return `Refund processed – order ${o.orderNo}`;
    case "store_new_order":
      return `New order ${o.orderNo} – ${inr(o.total)} – ${o.paymentMethod === "cod" ? "COD" : o.paymentMethod === "offline" ? "paid offline" : "PayU"}`;
  }
}

export function OrderEmail({
  kind,
  order: o,
  brand,
  ctaUrl,
}: {
  kind: EmailKind;
  order: EmailOrder;
  brand: EmailBrand;
  ctaUrl: string;
}) {
  const copy = COPY[kind];
  const isStore = kind === "store_new_order";
  return (
    <Html lang="en">
      <Head />
      <Preview>{copy.preview(o)}</Preview>
      <Body
        style={{
          backgroundColor: C.khakiSoft,
          fontFamily: "Helvetica, Arial, sans-serif",
          margin: 0,
          padding: "24px 0",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 16,
            maxWidth: 560,
            margin: "0 auto",
            overflow: "hidden",
          }}
        >
          <Section
            style={{ backgroundColor: C.forestDeep, padding: "20px 28px" }}
          >
            <Row>
              <Column style={{ width: 52 }}>
                <Img
                  src={brand.logoUrl}
                  width="44"
                  height="44"
                  alt="Swadeshi Mahadev Products"
                />
              </Column>
              <Column>
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 16,
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  Swadeshi Mahadev Products
                </Text>
                <Text style={{ color: "#D0B17A", fontSize: 12, margin: 0 }}>
                  Wood-pressed in Bijainagar, Rajasthan
                </Text>
              </Column>
            </Row>
          </Section>

          <Section style={{ padding: "28px 28px 8px" }}>
            <Text
              style={{
                color: C.mustard,
                fontSize: 13,
                fontWeight: 700,
                margin: 0,
              }}
            >
              Order {o.orderNo}
            </Text>
            <Heading
              as="h1"
              style={{
                color: C.forest,
                fontSize: 24,
                lineHeight: "30px",
                margin: "6px 0 12px",
              }}
            >
              {copy.heading}
            </Heading>
            <Text
              style={{
                color: C.ink,
                fontSize: 15,
                lineHeight: "24px",
                margin: 0,
              }}
            >
              {isStore
                ? copy.intro(o)
                : `Hi ${o.name.split(" ")[0]}, ${copy.intro(o).charAt(0).toLowerCase()}${copy.intro(o).slice(1)}`}
            </Text>
            {o.note && (
              <Text
                style={{ color: C.muted, fontSize: 14, lineHeight: "22px" }}
              >
                {o.note}
              </Text>
            )}
          </Section>

          {kind === "shipped" && (o.awb || o.courier) && (
            <Section
              style={{
                margin: "8px 28px",
                backgroundColor: C.khakiSoft,
                borderRadius: 12,
                padding: "12px 16px",
              }}
            >
              <Text style={{ margin: 0, fontSize: 14, color: C.ink }}>
                Courier: <strong>{o.courier ?? "—"}</strong>
                <br />
                AWB: <strong>{o.awb ?? "—"}</strong>
              </Text>
              {o.trackingUrl?.startsWith("https://") && <Text style={{ margin: "8px 0 0", fontSize: 13 }}><Link href={o.trackingUrl} style={{ color: C.forest }}>Open courier tracking</Link></Text>}
            </Section>
          )}

          <Section style={{ padding: "16px 28px" }}>
            <Button
              href={ctaUrl}
              style={{
                backgroundColor: C.forest,
                borderRadius: 999,
                color: "#ffffff",
                fontSize: 15,
                fontWeight: 700,
                padding: "13px 24px",
              }}
            >
              {copy.cta ?? "View order"}
            </Button>
          </Section>
          {kind === "delivered" && (
            <Section style={{ padding: "0 28px 16px" }}>
              <Link href={o.invoiceUrl} style={{ color: C.forest, fontSize: 14, fontWeight: 700 }}>
                Download your invoice
              </Link>
            </Section>
          )}

          <Section style={{ padding: "0 28px" }}>
            <Hr style={{ borderColor: C.line }} />
            {o.items.map((i, n) => (
              <Row key={n} style={{ padding: "6px 0" }}>
                <Column>
                  <Text style={{ margin: 0, fontSize: 14, color: C.ink }}>
                    {i.qty} × {i.title}{" "}
                    <span style={{ color: C.muted }}>({i.size})</span>
                  </Text>
                </Column>
                <Column align="right" style={{ width: 90 }}>
                  <Text style={{ margin: 0, fontSize: 14, color: C.ink }}>
                    {inr(i.lineTotal)}
                  </Text>
                </Column>
              </Row>
            ))}
            <Hr style={{ borderColor: C.line }} />
            {[
              ["Subtotal", inr(o.subtotal)],
              ...(o.discount
                ? [
                    [
                      o.couponCode ? `Coupon (${o.couponCode})` : "Discount",
                      `−${inr(o.discount)}`,
                    ],
                  ]
                : []),
              ["Shipping", o.shipping ? inr(o.shipping) : "Free"],
              ...(o.codFee ? [["COD charge", inr(o.codFee)]] : []),
            ].map(([k, v]) => (
              <Row key={k}>
                <Column>
                  <Text
                    style={{ margin: "2px 0", fontSize: 14, color: C.muted }}
                  >
                    {k}
                  </Text>
                </Column>
                <Column align="right">
                  <Text style={{ margin: "2px 0", fontSize: 14, color: C.ink }}>
                    {v}
                  </Text>
                </Column>
              </Row>
            ))}
            <Row>
              <Column>
                <Text
                  style={{
                    margin: "6px 0",
                    fontSize: 16,
                    fontWeight: 700,
                    color: C.forest,
                  }}
                >
                  Total{" "}
                  {o.paymentMethod === "cod"
                    ? "(pay on delivery)"
                    : o.paymentMethod === "offline"
                      ? "(paid offline)"
                      : "(paid)"}
                </Text>
              </Column>
              <Column align="right">
                <Text
                  style={{
                    margin: "6px 0",
                    fontSize: 16,
                    fontWeight: 700,
                    color: C.forest,
                  }}
                >
                  {inr(o.total)}
                </Text>
              </Column>
            </Row>
          </Section>

          <Section style={{ padding: "8px 28px 20px" }}>
            <Text
              style={{
                fontSize: 13,
                color: C.muted,
                lineHeight: "20px",
                margin: 0,
              }}
            >
              <strong style={{ color: C.ink }}>Delivering to</strong>
              <br />
              {o.name}, {o.address}
              <br />
              {o.phone}
              {isStore && o.email ? ` · ${o.email}` : ""}
            </Text>
          </Section>

          <Section
            style={{ backgroundColor: C.khakiSoft, padding: "16px 28px" }}
          >
            <Text
              style={{
                fontSize: 12,
                color: C.muted,
                lineHeight: "18px",
                margin: 0,
              }}
            >
              Questions?{" "}
              <Link
                href={brand.whatsappUrl}
                style={{ color: C.forest, fontWeight: 700 }}
              >
                WhatsApp us
              </Link>{" "}
              or call {brand.phone} ({brand.supportHours}).
              <br />
              {brand.address} · FSSAI Lic. No. {brand.fssai}
              <br />
              <Link href={brand.siteUrl} style={{ color: C.forest }}>
                {brand.siteUrl.replace(/^https?:\/\//, "")}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
