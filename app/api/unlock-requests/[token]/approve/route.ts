// ============================================================
// app/api/unlock-requests/[token]/approve/route.ts
// POST /api/unlock-requests/:token/approve — keyholder approves
// ============================================================
// The token here is the approvalToken from the keyholder email.
// This route does NOT require user auth — the token IS the auth.
// This token is never sent to the box owner under any circumstance.
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

    // Approve the request and unlock the box in a transaction
    await prisma.$transaction([
      prisma.unlockRequest.update({
        where: { id: unlockRequest.id },
        data: {
          status: UNLOCK_STATUS.APPROVED,
          resolvedAt: new Date(),
        },
      }),
      prisma.box.update({
        where: { id: unlockRequest.boxId },
        data: { status: BOX_STATUS.UNLOCKED },
      }),
    ]);

    return NextResponse.json({
      approved: true,
      boxName: unlockRequest.box.name,
    });
  } catch (error) {
    console.error("[POST /api/unlock-requests/:token/approve]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
