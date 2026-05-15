// ============================================================
// app/api/boxes/[id]/lock/route.ts
// POST /api/boxes/:id/lock
//
// Locks a box to a specified `lockType`. Used by the native
// change-protection flow and the simple "lock this box now"
// action on the Boxes screen.
//
// SECURITY RULES (server-side only, never trust the client):
//   - Owner-only (Bearer or session)
//   - Wallet box cannot be locked
//   - Closed box cannot be locked
//   - Cannot lock a box inside an active temporary unlock window
//   - KEYHOLDER lockType requires an ACTIVE KeyholderRelationship
//     that covers this box (ALL scope, or SELECTED with this boxId
//     in the join table)
//   - HARD and KEYHOLDER both auto-lock (status=LOCKED,
//     lockedAmount=balance)
//   - SOFT lock leaves lockedAmount at the user's choice (or 0
//     by default — partial lock UI lives elsewhere)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BOX_STATUS } from "@/lib/types";
import { getRequestUserId } from "@/lib/mobile-auth";

export const runtime = "nodejs";

type LockType = "SOFT" | "HARD" | "KEYHOLDER";
const VALID_LOCK_TYPES: LockType[] = ["SOFT", "HARD", "KEYHOLDER"];

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

    const body = await req.json().catch(() => ({}));
    const lockType: string | undefined = body?.lockType;
    const keyholderRelationshipId: string | undefined =
      body?.keyholderRelationshipId;

    if (!lockType || !VALID_LOCK_TYPES.includes(lockType as LockType)) {
      return NextResponse.json(
        { error: "lockType must be SOFT, HARD, or KEYHOLDER." },
        { status: 400 },
      );
    }

    const box = await prisma.box.findUnique({ where: { id } });
    if (!box) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }
    if (box.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (box.isWallet) {
      return NextResponse.json(
        { error: "The Wallet cannot be locked." },
        { status: 400 },
      );
    }
    if (box.isClosed) {
      return NextResponse.json(
        { error: "Closed boxes cannot be locked." },
        { status: 400 },
      );
    }
    if (
      box.temporaryUnlockExpiresAt &&
      box.temporaryUnlockExpiresAt > new Date()
    ) {
      return NextResponse.json(
        {
          error:
            "Cannot change protection during a temporary unlock window. Wait for it to expire.",
          code: "temporary_unlock_active",
        },
        { status: 409 },
      );
    }

    // KEYHOLDER lock requires an active relationship covering this box.
    if (lockType === "KEYHOLDER") {
      if (!keyholderRelationshipId) {
        return NextResponse.json(
          {
            error: "keyholderRelationshipId is required for KEYHOLDER lock.",
            code: "keyholder_required",
          },
          { status: 400 },
        );
      }
      const rel = await prisma.keyholderRelationship.findFirst({
        where: {
          id: keyholderRelationshipId,
          userId,
          status: "ACTIVE",
          OR: [
            { scopeType: "ALL" },
            { scopeType: "SELECTED", boxes: { some: { boxId: id } } },
          ],
        },
        select: { id: true, scopeType: true },
      });
      if (!rel) {
        // If the relationship exists but doesn't yet cover this box,
        // and the scope is SELECTED, attach it as part of the lock.
        const ownedRel = await prisma.keyholderRelationship.findFirst({
          where: {
            id: keyholderRelationshipId,
            userId,
            status: "ACTIVE",
            scopeType: "SELECTED",
          },
          select: { id: true },
        });
        if (!ownedRel) {
          return NextResponse.json(
            {
              error: "No active keyholder relationship matches that id.",
              code: "keyholder_not_active",
            },
            { status: 400 },
          );
        }
        // Attach this box to the SELECTED relationship.
        await prisma.keyholderRelationshipBox.upsert({
          where: {
            relationshipId_boxId: {
              relationshipId: ownedRel.id,
              boxId: id,
            },
          },
          update: {},
          create: { relationshipId: ownedRel.id, boxId: id },
        });
      }
    }

    // HARD and KEYHOLDER auto-lock with the full balance protected.
    // SOFT lock simply sets status=LOCKED and leaves lockedAmount
    // at the user's choice (board: partial-lock UI lives elsewhere).
    const autoLockAll = lockType === "HARD" || lockType === "KEYHOLDER";

    const updated = await prisma.box.update({
      where: { id },
      data: {
        lockType: lockType as LockType,
        status: BOX_STATUS.LOCKED,
        lockedAmount: autoLockAll ? box.balance : box.lockedAmount,
      },
    });

    await prisma.auditEvent.create({
      data: {
        actor: "USER",
        actorId: userId,
        action: "LOCK",
        targetId: id,
        metadata: JSON.stringify({
          boxId: id,
          lockType,
          source: "mobile",
        }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[POST /api/boxes/:id/lock]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
