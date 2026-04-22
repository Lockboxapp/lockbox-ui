import * as React from "react";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";
import { PostHogInit } from "@/components/PostHogInit";

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
