// ============================================================
// app/api/unlock-requests/[token]/cancel-by-user/route.ts
// POST — user cancels a keyholder-approved transfer before accepting.
// Funds remain in the source box. Idempotent.
//
// Dynamic slot `[token]` exists for route-collision compatibility with
// the sibling approve/deny routes. The value here is the
// UnlockRequest.id, session-authed by the box owner.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UNLOCK_STATUS } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const unlockRequest = await prisma.unlockRequest.findUnique({
      where: { id },
      include: { box: true },
    });

    if (!unlockRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (unlockRequest.box.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Idempotent: already cancelled → OK
    if (unlockRequest.status === UNLOCK_STATUS.CANCELLED_BY_USER) {
      return NextResponse.json({ ok: true, alreadyCancelled: true });
    }

    // Cannot cancel an already-executed or terminal request.
    if (unlockRequest.status !== UNLOCK_STATUS.PENDING_USER_ACCEPTANCE) {
      return NextResponse.json(
        {
          error: `Request is not awaiting your acceptance (status: ${unlockRequest.status}).`,
        },
        { status: 409 },
      );
    }

    await prisma.unlockRequest.update({
      where: { id: unlockRequest.id },
      data: {
        status: UNLOCK_STATUS.CANCELLED_BY_USER,
        resolvedAt: new Date(),
      },
    });

    await prisma.auditEvent.create({
      data: {
        actor: "USER",
        actorId: session.user.id,
        action: "TRANSFER_CANCELLED_BY_USER",
        targetId: unlockRequest.id,
        metadata: JSON.stringify({
          boxId: unlockRequest.boxId,
          destinationBoxId: unlockRequest.destinationBoxId,
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      sourceBoxName: unlockRequest.box.name,
    });
  } catch (err) {
    console.error("[POST /api/unlock-requests/:id/cancel-by-user]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
