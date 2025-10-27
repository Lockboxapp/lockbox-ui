// app/providers.tsx
"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  // Add any other client-only providers here later (theme, toasts, etc.)
  return <SessionProvider>{children}</SessionProvider>;
}
