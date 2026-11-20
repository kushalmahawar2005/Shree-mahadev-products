import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from "@react-email/components";

/**
 * Code email: brand header, the 6-digit code large, validity and a "not you?" line. Login by default;
 * `title` / `intro` / `preview` reuse it for other codes (e.g. refund approval).
 */
export function OtpEmail({
  code,
  minutes,
  logoUrl,
  siteName,
  title = "Your login code",
  intro,
  preview,
}: {
  code: string;
  minutes: number;
  logoUrl: string;
  siteName: string;
  title?: string;
  intro?: string;
  preview?: string;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview ?? `${code} is your ${siteName} login code`}</Preview>
      <Body style={{ backgroundColor: "#F6EFE2", fontFamily: "Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: 460, margin: "0 auto", backgroundColor: "#ffffff", borderRadius: 16, padding: "28px 28px 24px", border: "1px solid #E8DCC4" }}>
          <Img src={logoUrl} width="64" height="64" alt={siteName} style={{ margin: "0 auto 12px" }} />
          <Heading as="h1" style={{ fontSize: 20, color: "#0B3D2A", textAlign: "center", margin: "0 0 6px" }}>
            {title}
          </Heading>
          <Text style={{ fontSize: 14, color: "#5b6157", textAlign: "center", margin: "0 0 18px" }}>
            {intro ?? `Enter this code on ${siteName} to sign in.`}
          </Text>
          <Section style={{ backgroundColor: "#F6EFE2", borderRadius: 12, padding: "14px 0", textAlign: "center" }}>
            <Text style={{ fontSize: 32, letterSpacing: 8, fontWeight: 700, color: "#0B3D2A", margin: 0, fontFamily: "Menlo, Consolas, monospace" }}>
              {code}
            </Text>
          </Section>
          <Text style={{ fontSize: 13, color: "#5b6157", textAlign: "center", margin: "16px 0 0" }}>
            The code works for {minutes} minutes. Never share it with anyone, not even our team.
          </Text>
          <Text style={{ fontSize: 12, color: "#8a8f86", textAlign: "center", margin: "12px 0 0" }}>
            Didn&apos;t ask for this? You can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
