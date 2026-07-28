import type { Metadata } from "next";
import { EB_Garamond, Figtree } from "next/font/google";
import "./globals.css";

const displayFont = EB_Garamond({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-display",
});

const bodyFont = Figtree({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-body",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ScholarMatch AI — Don’t hunt, just match",
    template: "%s · ScholarMatch AI",
  },
  description:
    "Build one student profile and explore explainable scholarship matches shaped by verified eligibility, goals, and application readiness.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "ScholarMatch AI",
    title: "ScholarMatch AI — Don’t hunt, just match",
    description:
      "Explainable scholarship discovery built around verified eligibility and the facts students choose to share.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "ScholarMatch AI — Don’t hunt, just match",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ScholarMatch AI — Don’t hunt, just match",
    description:
      "Explainable scholarship discovery built around verified eligibility.",
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
