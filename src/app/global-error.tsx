"use client";

/**
 * Last-resort error page, shown when even the root layout fails. It replaces the whole document, so
 * it carries its own <html>/<body> and inline styles (no app CSS or fonts can be assumed here).
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = (error as { digest?: string } | null)?.digest;
  return (
    <html lang="en-IN">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#F5EDDE", color: "#1d2a22", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
        <main style={{ maxWidth: 520, padding: "32px 20px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#b49024" }}>Swadeshi Mahadev Products</p>
          <h1 style={{ margin: "8px 0 0", fontSize: 32, lineHeight: 1.2, color: "#0c3c24" }}>Something went wrong</h1>
          <p style={{ margin: "14px 0 0", fontSize: 17, lineHeight: 1.5, color: "#5b6b62" }}>
            The site hit a problem loading this page. Please try again in a moment.
          </p>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={() => retry()} style={{ height: 48, padding: "0 24px", borderRadius: 999, border: 0, background: "#0c3c24", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full reload on purpose: the app shell failed */}
            <a href="/" style={{ height: 48, padding: "0 24px", borderRadius: 999, border: "1px solid #0c3c24", color: "#0c3c24", fontSize: 15, fontWeight: 600, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
              Go to home
            </a>
          </div>
          <p style={{ marginTop: 24, fontSize: 14, color: "#5b6b62" }}>
            Need help? WhatsApp us on <a href="https://wa.me/918440099585" style={{ color: "#0c3c24", fontWeight: 600 }}>+91-8440099585</a>.
          </p>
          {digest && <p style={{ marginTop: 8, fontSize: 12, color: "#8a968f" }}>Ref: {digest}</p>}
        </main>
      </body>
    </html>
  );
}
