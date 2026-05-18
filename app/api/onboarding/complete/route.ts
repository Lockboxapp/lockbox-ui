// ============================================================
// app/api/onboarding/complete/route.ts
// POST /api/onboarding/complete
// Marks User.onboardingCompletedAt for admin analytics.
// Idempotent: no-op if already set.
//
// Native onboarding v2 — auth migrated to getRequestUserId so the
// native app's `Authorization: Bearer` token resolves (cookie-only
// getServerSession silently 401'd every native request).
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

    // Idempotent — only stamp the timestamp the first time.
    const result = await prisma.user.updateMany({
      where: { id: userId, onboardingCompletedAt: null },
      data: { onboardingCompletedAt: new Date() },
    });

    if (result.count > 0) {
      const ph = getServerPosthog();
      ph.capture({
        distinctId: userId,
        event: "onboarding_complete",
      });
      await ph.shutdown();
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingCompletedAt: true },
    });

    return NextResponse.json({
      ok: true,
      onboardingCompletedAt: user?.onboardingCompletedAt ?? null,
    });
  } catch (err) {
    console.error("[POST /api/onboarding/complete]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
