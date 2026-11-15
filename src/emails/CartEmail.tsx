import { Body, Button, Column, Container, Head, Heading, Hr, Html, Img, Link, Preview, Row, Section, Text } from "@react-email/components";
import type { EmailBrand } from "./OrderEmail";

export type CartEmailData = {
  name: string;
  stage: 1 | 2;
  recoveryUrl: string;
  subtotal: number;
  items: { title: string; size: string; qty: number; lineTotal: number; image?: string }[];
};

const C = { forest: "#0C3C24", forestDeep: "#072F1B", mustard: "#B49024", khakiSoft: "#F6EFE2", ink: "#1A1A17", muted: "#5C5A52", line: "#E7DFCF" };
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Abandoned-cart reminder: the items with photos and one button back to the saved cart. */
export function CartEmail({ cart, brand }: { cart: CartEmailData; brand: EmailBrand }) {
  const first = cart.stage === 1;
  return (
    <Html lang="en">
      <Head />
      <Preview>{first ? "Your cart is saved. Finish your order in one tap." : "Last reminder: your cart is still waiting."}</Preview>
      <Body style={{ backgroundColor: C.khakiSoft, fontFamily: "Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 16, maxWidth: 560, margin: "0 auto", overflow: "hidden" }}>
          <Section style={{ backgroundColor: C.forestDeep, padding: "20px 28px" }}>
            <Row>
              <Column style={{ width: 52 }}>
                <Img src={brand.logoUrl} width="44" height="44" alt="Swadeshi Mahadev Products" />
              </Column>
              <Column>
                <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: 700, margin: 0 }}>Swadeshi Mahadev Products</Text>
                <Text style={{ color: "#D0B17A", fontSize: 12, margin: 0 }}>Wood-pressed in Bijainagar, Rajasthan</Text>
              </Column>
            </Row>
          </Section>

          <Section style={{ padding: "28px 28px 8px" }}>
            <Heading as="h1" style={{ color: C.forest, fontSize: 24, lineHeight: "30px", margin: "0 0 12px" }}>
              {first ? "You left something behind" : "Your cart is still waiting"}
            </Heading>
            <Text style={{ color: C.ink, fontSize: 15, lineHeight: "24px", margin: 0 }}>
              {first
                ? `Hi ${cart.name}, your cart is saved. Small-batch oils sell out fast, so finish your order while these are in stock.`
                : `Hi ${cart.name}, just a last reminder: your cart is saved for you. Free delivery and cash on delivery are available at checkout.`}
            </Text>
          </Section>

          <Section style={{ padding: "8px 28px" }}>
            <Hr style={{ borderColor: C.line }} />
            {cart.items.map((i, n) => (
              <Row key={n} style={{ padding: "6px 0" }}>
                <Column style={{ width: 64, verticalAlign: "middle" }}>
                  {i.image ? (
                    <Img src={i.image} width="52" height="65" alt={i.title} style={{ borderRadius: 10, border: `1px solid ${C.line}`, display: "block" }} />
                  ) : (
                    <div style={{ width: 52, height: 65, borderRadius: 10, backgroundColor: C.khakiSoft }} />
                  )}
                </Column>
                <Column style={{ verticalAlign: "middle" }}>
                  <Text style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.ink, lineHeight: "20px" }}>{i.title}</Text>
                  <Text style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: "18px" }}>
                    {i.size} · Qty {i.qty}
                  </Text>
                </Column>
                <Column align="right" style={{ width: 90, verticalAlign: "middle" }}>
                  <Text style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.ink }}>{inr(i.lineTotal)}</Text>
                </Column>
              </Row>
            ))}
            <Hr style={{ borderColor: C.line }} />
            <Row>
              <Column>
                <Text style={{ margin: "4px 0", fontSize: 16, fontWeight: 700, color: C.forest }}>Cart total</Text>
              </Column>
              <Column align="right">
                <Text style={{ margin: "4px 0", fontSize: 16, fontWeight: 700, color: C.forest }}>{inr(cart.subtotal)}</Text>
              </Column>
            </Row>
          </Section>

          <Section style={{ padding: "12px 28px 28px" }}>
            <Button href={cart.recoveryUrl} style={{ backgroundColor: C.forest, borderRadius: 999, color: "#ffffff", fontSize: 15, fontWeight: 700, padding: "13px 24px" }}>
              Complete your order
            </Button>
          </Section>

          <Section style={{ backgroundColor: C.khakiSoft, padding: "16px 28px" }}>
            <Text style={{ fontSize: 12, color: C.muted, lineHeight: "18px", margin: 0 }}>
              Questions?{" "}
              <Link href={brand.whatsappUrl} style={{ color: C.forest, fontWeight: 700 }}>
                WhatsApp us
              </Link>{" "}
              or call {brand.phone} ({brand.supportHours}).
              <br />
              You got this because you started a checkout on{" "}
              <Link href={brand.siteUrl} style={{ color: C.forest }}>
                {brand.siteUrl.replace(/^https?:\/\//, "")}
              </Link>
              . We send at most two reminders.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
