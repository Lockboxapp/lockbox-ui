"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode, useEffect } from "react";
import { initPostHog } from "@/lib/posthog";

/**
 * Global client-side providers for things like NextAuth,
 * theme, or any global context hooks.
 */
export default function ClientProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}
