// ============================================================
// lib/posthog-server.ts
// Server-side PostHog — API routes only
// ============================================================
// IMPORTANT: serverless-safe. Per-request instance + immediate flush
// + explicit shutdown so events reach PostHog before the function dies.
// Singletons cause batching issues on Vercel because the function may
// terminate before the batch is flushed.
// ============================================================

import { PostHog } from "posthog-node";

/**
 * Create a fresh PostHog client for a single request.
 * flushAt: 1 + flushInterval: 0 forces immediate send on each capture.
 */
export function getServerPosthog() {
  return new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "", {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
}

/**
 * Fire-and-forget capture that ALSO awaits shutdown so the event
 * reaches PostHog before the serverless function exits.
 *
 * Always awaited at the call site:
 *   await captureServer("event_name", userId, { ... });
 *
 * Never throws — telemetry must not affect request handling.
 */
export async function captureServer(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  const ph = getServerPosthog();
  try {
    ph.capture({ distinctId, event, properties });
    await ph.shutdown();
  } catch {
    // swallow — telemetry must not affect request handling
  }
}
