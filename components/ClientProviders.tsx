"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

/**
 * Global client-side providers for things like NextAuth,
 * theme, or any global context hooks.
 * PostHog is initialized via instrumentation-client.ts (Next.js 15.3+).
 */
export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}
