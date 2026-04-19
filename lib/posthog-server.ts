// ============================================================
// lib/posthog-server.ts
// Server-side PostHog — API routes only
// ============================================================
// Serverless-safe: per-request client + immediate flush.
// Each route MUST follow the pattern:
//
//   const ph = getServerPosthog();
//   ph.capture({ distinctId, event, properties });
//   await ph.shutdown();
//
// The await on shutdown() forces the event to flush before Vercel
// closes the function. Without this, events are queued but never sent.
// ============================================================

import { PostHog } from "posthog-node";

export function getServerPosthog() {
  return new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "", {
    // Honor host override from env (US ingest is the working endpoint;
    // app.posthog.com is the dashboard, not the ingest URL).
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
}
