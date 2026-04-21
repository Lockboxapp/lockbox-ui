// ============================================================
// app/api/unlock-requests/[token]/accept/route.ts
// POST — user accepts a keyholder-approved TRANSFER to a HARD/KEYHOLDER
// destination. Executes the transfer atomically. Idempotent.
//
// The dynamic slot is named `[token]` to coexist with the sibling
// approve/deny routes, but the incoming value here is the
// UnlockRequest.id (session-authed by the owner, not keyholder-token-authed).
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

    // Idempotency — already accepted, cancelled, or failed: return the current state.
    if (unlockRequest.status === UNLOCK_STATUS.APPROVED) {
      return NextResponse.json({ ok: true, alreadyAccepted: true });
    }
    if (
      unlockRequest.status === UNLOCK_STATUS.CANCELLED_BY_USER ||
      unlockRequest.status === UNLOCK_STATUS.FAILED ||
      unlockRequest.status === UNLOCK_STATUS.DENIED
    ) {
      return NextResponse.json(
        { error: `Request already ${unlockRequest.status.toLowerCase()}` },
        { status: 409 },
      );
    }
    if (unlockRequest.status !== UNLOCK_STATUS.PENDING_USER_ACCEPTANCE) {
      return NextResponse.json(
        { error: `Request is not awaiting your acceptance (status: ${unlockRequest.status}).` },
        { status: 409 },
      );
    }

    // Validate transfer payload is intact
    const amt = unlockRequest.transferAmount ?? 0;
    const destId = unlockRequest.destinationBoxId;
    if (!destId || amt <= 0 || unlockRequest.requestType !== "TRANSFER") {
      return NextResponse.json(
        { error: "Invalid transfer request data" },
        { status: 400 },
      );
    }

    const destBox = await prisma.box.findUnique({ where: { id: destId } });
    if (!destBox || destBox.userId !== session.user.id || destBox.isClosed) {
      return NextResponse.json(
        { error: "Destination box unavailable" },
        { status: 400 },
      );
    }

    // Re-check source funds (keyholder-approved funds could have been withdrawn
    // by some other path since approval — defense in depth).
    if (unlockRequest.box.lockedAmount < amt) {
      return NextResponse.json(
        { error: "Locked amount insufficient for transfer" },
        { status: 400 },
      );
    }

    try {
      await prisma.$transaction([
        prisma.box.update({
          where: { id: unlockRequest.boxId },
          data: {
            balance: { decrement: amt },
            lockedAmount: { decrement: amt },
          },
        }),
        prisma.box.update({
          where: { id: destId },
          data: { balance: { increment: amt } },
        }),
        prisma.transaction.create({
          data: {
            userId: session.user.id,
            boxId: unlockRequest.boxId,
            type: "TRANSFER_OUT",
            amount: amt,
            description: `Keyholder-approved transfer to ${destBox.name}`,
          },
        }),
        prisma.transaction.create({
          data: {
            userId: session.user.id,
            boxId: destId,
            type: "TRANSFER_IN",
            amount: amt,
            description: `Keyholder-approved transfer from ${unlockRequest.box.name}`,
          },
        }),
        prisma.unlockRequest.update({
          where: { id: unlockRequest.id },
          data: { status: UNLOCK_STATUS.APPROVED, resolvedAt: new Date() },
        }),
      ]);
    } catch (txErr) {
      console.error("[accept/TRANSFER] $transaction failed:", txErr);
      await prisma.unlockRequest.update({
        where: { id: unlockRequest.id },
        data: { status: UNLOCK_STATUS.FAILED, resolvedAt: new Date() },
      });
      await prisma.auditEvent.create({
        data: {
          actor: "SYSTEM",
          action: "TRANSFER_FAILED",
          targetId: unlockRequest.id,
          metadata: JSON.stringify({
            boxId: unlockRequest.boxId,
            reason: (txErr as Error)?.message ?? "unknown",
          }),
        },
      });
      return NextResponse.json(
        {
          error:
            "Transfer could not be completed. The request has been marked failed.",
          status: UNLOCK_STATUS.FAILED,
        },
        { status: 500 },
      );
    }

    await prisma.auditEvent.create({
      data: {
        actor: "USER",
        actorId: session.user.id,
        action: "TRANSFER_ACCEPTED_BY_USER",
        targetId: unlockRequest.id,
        metadata: JSON.stringify({
          boxId: unlockRequest.boxId,
          destinationBoxId: destId,
          amountCents: amt,
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      amountDollars: amt / 100,
      destinationBoxName: destBox.name,
      sourceBoxName: unlockRequest.box.name,
    });
  } catch (err) {
    console.error("[POST /api/unlock-requests/:id/accept]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
