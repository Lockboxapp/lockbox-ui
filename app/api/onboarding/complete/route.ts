// ============================================================
// app/api/onboarding/complete/route.ts
// POST /api/onboarding/complete
// Marks User.onboardingCompletedAt for admin analytics.
// Idempotent: no-op if already set.
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { captureServer } from "@/lib/posthog-server";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await prisma.user.updateMany({
      where: { id: session.user.id, onboardingCompletedAt: null },
      data: { onboardingCompletedAt: new Date() },
    });
    if (result.count > 0) {
      await captureServer("onboarding_complete", session.user.id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/onboarding/complete]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
