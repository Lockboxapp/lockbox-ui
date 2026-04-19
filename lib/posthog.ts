// ============================================================
// lib/posthog.ts
// Client-side PostHog — browser only
// ============================================================

import posthog from "posthog-js";

export function initPostHog() {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  if ((posthog as unknown as { __loaded?: boolean }).__loaded) return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: "https://app.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
  });
}

export function capture(event: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.capture(event, properties);
  } catch {
    // never let telemetry break UX
  }
}

export { posthog };
