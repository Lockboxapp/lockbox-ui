// ============================================================
// lib/posthog-server.ts
// Server-side PostHog — API routes only
// ============================================================

import { PostHog } from "posthog-node";

const globalForPostHog = globalThis as unknown as { serverPosthog?: PostHog };

export const serverPosthog =
  globalForPostHog.serverPosthog ??
  new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "", {
    host: "https://app.posthog.com",
    // flushAt=1 in dev so events show immediately; batch in prod
    flushAt: process.env.NODE_ENV === "production" ? 20 : 1,
    flushInterval: 10000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPostHog.serverPosthog = serverPosthog;
}

/**
 * Fire-and-forget capture. Never throws. Never blocks the request.
 * distinctId: user id if known, otherwise a synthetic id like "anon:<random>" or the email.
 */
export function captureServer(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>,
) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    serverPosthog.capture({ distinctId, event, properties });
  } catch {
    // swallow — telemetry must not affect request handling
  }
}
