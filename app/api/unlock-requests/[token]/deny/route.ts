// ============================================================
// app/api/unlock-requests/[token]/deny/route.ts
// POST /api/unlock-requests/:token/deny — keyholder denies
// ============================================================
// Denying sets a 24-hour cooldown before the user can re-request.
// Cooldown is stored server-side — client cannot bypass it.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BOX_STATUS, UNLOCK_STATUS } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const unlockRequest = await prisma.unlockRequest.findUnique({
      where: { approvalToken: params.token },
      include: { box: true },
    });

    if (!unlockRequest) {
      return NextResponse.json(
        { error: "Invalid or expired approval token" },
        { status: 404 }
      );
    }

    if (unlockRequest.status !== UNLOCK_STATUS.PENDING) {
      return NextResponse.json(
        { error: `Request already ${unlockRequest.status.toLowerCase()}` },
        { status: 409 }
      );
    }

    // 24-hour cooldown before user can submit another request
    const cooldownUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Deny the request and revert box to LOCKED in a transaction
    await prisma.$transaction([
      prisma.unlockRequest.update({
        where: { id: unlockRequest.id },
        data: {
          status: UNLOCK_STATUS.DENIED,
          resolvedAt: new Date(),
          cooldownUntil,
        },
      }),
      prisma.box.update({
        where: { id: unlockRequest.boxId },
        data: { status: BOX_STATUS.LOCKED },
      }),
    ]);

    return NextResponse.json({
      denied: true,
      boxName: unlockRequest.box.name,
      cooldownUntil,
    });
  } catch (error) {
    console.error("[POST /api/unlock-requests/:token/deny]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
