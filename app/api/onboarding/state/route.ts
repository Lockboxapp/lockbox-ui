// ============================================================
// app/api/onboarding/state/route.ts
// PATCH /api/onboarding/state
//
// Native onboarding v2 — syncs the onboarding funnel state to the
// server for cross-device recovery. Each PATCH shallow-merges the
// provided fields into the User.onboardingState JSON blob.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getRequestUserId } from "@/lib/mobile-auth";

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const patch =
      body && typeof body === "object" && !Array.isArray(body) ? body : {};

    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingState: true },
    });
    if (!current) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const prev = current.onboardingState;
    const existing =
      prev && typeof prev === "object" && !Array.isArray(prev) ? prev : {};
    const merged = { ...existing, ...patch };

    await prisma.user.update({
      where: { id: userId },
      data: { onboardingState: merged as Prisma.InputJsonValue },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[PATCH /api/onboarding/state]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
