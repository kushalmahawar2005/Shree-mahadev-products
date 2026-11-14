/**
 * Single source of truth for the Content-Security-Policy. To allow a new third party
 * (e.g. Meta Pixel, GA4 later), add its hosts here only.
 */
const isDev = process.env.NODE_ENV !== "production";

export const CSP_SOURCES = {
  script: ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])], // Next.js inline bootstrap scripts
  style: ["'self'", "'unsafe-inline'"],
  img: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://i.ytimg.com"],
  media: ["'self'", "https://res.cloudinary.com"],
  font: ["'self'", "data:"],
  connect: ["'self'", "https://api.cloudinary.com", ...(isDev ? ["ws:"] : [])],
  // Reels pasted as YouTube links play in YouTube's privacy-enhanced embed player.
  frame: ["https://www.youtube-nocookie.com"],
  // PayU hosted checkout POST. Chrome applies form-action to the redirects after the POST too, and
  // PayU hops to other subdomains (api.payu.in etc.), so allow all of them or the submit is silently blocked.
  formAction: ["'self'", "https://*.payu.in", "https://*.payubiz.in"],
};

export function contentSecurityPolicy() {
  const s = CSP_SOURCES;
  return [
    "default-src 'self'",
    `script-src ${s.script.join(" ")}`,
    `style-src ${s.style.join(" ")}`,
    `img-src ${s.img.join(" ")}`,
    `media-src ${s.media.join(" ")}`,
    `font-src ${s.font.join(" ")}`,
    `connect-src ${s.connect.join(" ")}`,
    `frame-src ${s.frame.join(" ")}`,
    `form-action ${s.formAction.join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];
