// ============================================================
// app/api/keyholder/requests/[id]/approve/route.ts
// POST /api/keyholder/requests/:id/approve
//
// Native keyholder approval path. Auth via Bearer / NextAuth
// session. The heavy business logic (atomic transfers, status
// transitions, owner emails, audit events, PostHog) lives in
// lib/keyholder-actions.ts and is reused here.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestUserId } from "@/lib/mobile-auth";
import { approveUnlockRequest } from "@/lib/keyholder-actions";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!me?.email) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await approveUnlockRequest({
      unlockRequestId: id,
      actorUserId: userId,
      actorEmail: me.email,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status },
      );
    }

    return NextResponse.json({
      approved: true,
      pendingUserAcceptance: result.pendingUserAcceptance,
      boxName: result.boxName,
      destinationBoxName: result.destinationBoxName ?? null,
    });
  } catch (err) {
    console.error("[POST /api/keyholder/requests/:id/approve]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
