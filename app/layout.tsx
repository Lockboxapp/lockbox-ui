import * as React from "react";
import type { Metadata } from "next";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";
import { PostHogInit } from "@/components/PostHogInit";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lockboxfinance.com";

const description =
  "LockBox locks your bill money safely away until the day it's due — keeping your funds private, protected from impulse spending, and accessible exactly when you actually need them. Secure what matters. Access with confidence.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "LockBox — Secure what matters. Access with confidence.",
    template: "%s · LockBox",
  },
  description,
  applicationName: "LockBox",
  openGraph: {
    type: "website",
    siteName: "LockBox",
    url: "/",
    title: "LockBox — Secure what matters. Access with confidence.",
    description,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "LockBox — Secure what matters. Access with confidence.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LockBox — Secure what matters. Access with confidence.",
    description,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <PostHogInit />
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
