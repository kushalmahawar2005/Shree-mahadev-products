import type { Metadata } from "next";
import { Figtree, Mukta } from "next/font/google";
import "../globals.css";
import { adminThemeScript } from "@/components/admin/theme-script";

/** Clean geometric sans (close to Cowberry's look). Mukta covers Devanagari. */
const figtree = Figtree({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

const mukta = Mukta({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "devanagari"],
  variable: "--font-mukta",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Mahadev Admin" },
  robots: { index: false, follow: false },
  
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${figtree.variable} ${mukta.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: adminThemeScript }} />
      </head>
      <body className="min-h-dvh bg-canvas text-ink" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
