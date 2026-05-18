// ============================================================
// app/api/onboarding/analytics/route.ts
// POST /api/onboarding/analytics
//
// Native onboarding v2 — persists funnel analytics. The cohort
// dimensions that have User columns (intent, version, source) are
// written to the User row; the full payload goes to PostHog for
// funnel analysis (lockTypeSelected / targetDateSet /
// timeToReachLockScreen have no User column by design).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestUserId } from "@/lib/mobile-auth";
import { getServerPosthog } from "@/lib/posthog-server";

export async function POST(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const onboardingIntent =
      typeof body?.onboardingIntent === "string"
        ? body.onboardingIntent
        : undefined;
    const onboardingVersion =
      typeof body?.onboardingVersion === "string"
        ? body.onboardingVersion
        : undefined;
    const onboardingSource =
      typeof body?.onboardingSource === "string"
        ? body.onboardingSource
        : undefined;

    await prisma.user.update({
      where: { id: userId },
      data: { onboardingIntent, onboardingVersion, onboardingSource },
    });

    const ph = getServerPosthog();
    ph.capture({
      distinctId: userId,
      event: "onboarding_analytics_saved",
      properties: {
        onboardingIntent: onboardingIntent ?? null,
        lockTypeSelected:
          typeof body?.lockTypeSelected === "string"
            ? body.lockTypeSelected
            : null,
        targetDateSet: Boolean(body?.targetDateSet),
        onboardingSource: onboardingSource ?? null,
        onboardingVersion: onboardingVersion ?? null,
        timeToReachLockScreen:
          typeof body?.timeToReachLockScreen === "number"
            ? body.timeToReachLockScreen
            : null,
      },
    });
    await ph.shutdown();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/onboarding/analytics]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
