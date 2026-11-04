import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type InquiryEmailData = {
  id: number;
  name: string;
  business: string;
  city: string;
  phone: string;
  email: string;
  product: string;
  quantity: string;
  message: string;
  adminUrl: string;
};

export function InquiryEmail({ inquiry }: { inquiry: InquiryEmailData }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        New bulk inquiry from {inquiry.business || inquiry.name}
      </Preview>
      <Body
        style={{
          backgroundColor: "#F6EFE2",
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
          <Section style={{ backgroundColor: "#072F1B", padding: "22px 28px" }}>
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
            <Text style={{ color: "#D0B17A", fontSize: 12, margin: "4px 0 0" }}>
              New bulk order inquiry
            </Text>
          </Section>
          <Section style={{ padding: "24px 28px" }}>
            <Heading
              as="h1"
              style={{ color: "#083928", fontSize: 22, margin: "0 0 14px" }}
            >
              Inquiry #{inquiry.id}
            </Heading>
            <Text
              style={{
                color: "#1A1A17",
                fontSize: 15,
                lineHeight: "24px",
                margin: 0,
              }}
            >
              <strong>{inquiry.name}</strong>
              {inquiry.business ? ` · ${inquiry.business}` : ""}
              <br />
              {inquiry.city}
              <br />
              <Link
                href={`tel:+91${inquiry.phone}`}
                style={{ color: "#0C3C24" }}
              >
                +91 {inquiry.phone}
              </Link>
              {inquiry.email && (
                <>
                  {" "}
                  ·{" "}
                  <Link
                    href={`mailto:${inquiry.email}`}
                    style={{ color: "#0C3C24" }}
                  >
                    {inquiry.email}
                  </Link>
                </>
              )}
              <br />
              <br />
              {inquiry.product} · {inquiry.quantity}
              {inquiry.message && (
                <>
                  <br />
                  <br />
                  {inquiry.message}
                </>
              )}
            </Text>
            <Link
              href={inquiry.adminUrl}
              style={{
                display: "inline-block",
                marginTop: 22,
                backgroundColor: "#0C3C24",
                borderRadius: 999,
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 700,
                padding: "12px 20px",
                textDecoration: "none",
              }}
            >
              Open inquiry
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
