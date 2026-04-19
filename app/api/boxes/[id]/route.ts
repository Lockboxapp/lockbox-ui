// ============================================================
// app/api/boxes/[id]/route.ts
// GET    /api/boxes/:id        — get a single box
// PATCH  /api/boxes/:id        — update box (including lock action)
// DELETE /api/boxes/:id        — close/delete a box
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BOX_STATUS } from "@/lib/types";
import { captureServer } from "@/lib/posthog-server";

// ------------------------------------------------------------
// GET — fetch a single box by id (must belong to authed user)
// ------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const box = await prisma.box.findUnique({
      where: { id: id },
      include: {
        unlockRequests: {
          orderBy: { requestedAt: "desc" },
        },
      },
    });

    if (!box) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    // Ensure the box belongs to the requesting user
    if (box.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(box);
  } catch (error) {
    console.error("[GET /api/boxes/:id]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ------------------------------------------------------------
// PATCH — update a box
// Handles general updates AND the lock action
// Body: { name?, description?, targetAmount?, action?: "lock" | "unlock", lockUntil? }
//
// LOCK RULES (server-enforced, never trust the client):
//   - Box must be in FUNDING status to lock
//   - lockUntil must be a future date
//   - Once locked, status moves to LOCKED server-side
// ------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const box = await prisma.box.findUnique({
      where: { id: id },
    });

    if (!box) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    if (box.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, targetAmount, action, lockUntil, lockType, keyholderRelationshipId, lockedAmountInDollars } =
      body;

    // Sprint 4 — Wallet is protected from all lock/unlock actions
    if (box.isWallet && (action === "lock" || action === "unlock")) {
      return NextResponse.json(
        { error: "The Wallet cannot be locked or unlocked. It is always liquid." },
        { status: 400 },
      );
    }

    // Sprint 7 — safety fallback: switch a KEYHOLDER box to SOFT (Flexible)
    // ONLY permitted when no active keyholder is attached to the box.
    // Preserves lockedAmount — user can then self-unlock via SOFT confirmation.
    if (action === "switchToFlexible") {
      if (box.isWallet) {
        return NextResponse.json({ error: "Wallet can't change protection type." }, { status: 400 });
      }
      if (box.lockType !== "KEYHOLDER") {
        return NextResponse.json(
          { error: "Only KEYHOLDER boxes can switch to Flexible via this path." },
          { status: 400 },
        );
      }
      const hasActive = await prisma.keyholderRelationship.findFirst({
        where: {
          userId: session.user.id,
          status: "ACTIVE",
          OR: [
            { scopeType: "ALL" },
            { scopeType: "SELECTED", boxes: { some: { boxId: id } } },
          ],
        },
        select: { id: true },
      });
      if (hasActive) {
        return NextResponse.json(
          { error: "This box has an active keyholder. Remove them before changing protection." },
          { status: 400 },
        );
      }
      const updated = await prisma.box.update({
        where: { id },
        data: { lockType: "SOFT" },
      });
      await prisma.auditEvent.create({
        data: {
          actor: "USER",
          actorId: session.user.id,
          action: "SWITCHED_TO_FLEXIBLE",
          targetId: id,
        },
      });
      return NextResponse.json(updated);
    }

    // Sprint 4 — reopen a closed box
    if (action === "reopen") {
      if (!box.isClosed) {
        return NextResponse.json({ error: "Box is not closed" }, { status: 400 });
      }
      const reopened = await prisma.box.update({
        where: { id },
        data: { isClosed: false },
      });
      return NextResponse.json(reopened);
    }

    // --------------------------------------------------------
    // LOCK ACTION — server enforces all lock rules
    // --------------------------------------------------------
    if (action === "lock") {
      // Sprint 8 BUG-01 fix: UNLOCKED boxes can be re-locked. This was the root
      // cause of HARD/KEYHOLDER boxes becoming stuck after self-unlock or approval.
      const lockableStatuses = [BOX_STATUS.CREATED, BOX_STATUS.FUNDING, "UNLOCKED"];
      if (!lockableStatuses.includes(box.status)) {
        return NextResponse.json(
          { error: `Cannot lock a box with status: ${box.status}` },
          { status: 400 },
        );
      }

      const resolvedLockType: string = lockType ?? box.lockType;
      const isSoft = resolvedLockType === "SOFT";

      // lockUntil is required for HARD and KEYHOLDER, optional for SOFT
      if (!lockUntil && !isSoft) {
        return NextResponse.json(
          { error: "lockUntil is required for HARD and KEYHOLDER lock types" },
          { status: 400 },
        );
      }

      if (lockUntil && new Date(lockUntil) <= new Date()) {
        return NextResponse.json(
          { error: "lockUntil must be a future date" },
          { status: 400 },
        );
      }

      // Partial lock: SOFT respects user-chosen lockedAmount; HARD/KEYHOLDER locks entire balance.
      let lockedAmount: number;
      if (resolvedLockType === "SOFT") {
        if (typeof lockedAmountInDollars === "number" && Number.isFinite(lockedAmountInDollars)) {
          const requested = Math.round(lockedAmountInDollars * 100);
          lockedAmount = Math.max(0, Math.min(box.balance, requested));
        } else {
          lockedAmount = box.balance;
        }
      } else {
        lockedAmount = box.balance;
      }

      const lockData: Record<string, unknown> = {
        status: BOX_STATUS.LOCKED,
        lockType: resolvedLockType,
        lockedAmount,
      };
      if (lockUntil) lockData.lockUntil = new Date(lockUntil);

      const lockedBox = await prisma.box.update({
        where: { id: id },
        data: lockData,
      });

      // If KEYHOLDER and a relationship ID was provided, link it to this box
      if (resolvedLockType === "KEYHOLDER" && keyholderRelationshipId) {
        const rel = await prisma.keyholderRelationship.findFirst({
          where: { id: keyholderRelationshipId, userId: session.user.id },
        });
        if (rel) {
          await prisma.keyholderRelationshipBox.upsert({
            where: {
              relationshipId_boxId: {
                relationshipId: keyholderRelationshipId,
                boxId: id,
              },
            },
            update: {},
            create: { relationshipId: keyholderRelationshipId, boxId: id },
          });
        }
      }

      await captureServer("box_locked", session.user.id, { lockType: resolvedLockType });
      return NextResponse.json(lockedBox);
    }
    // --------------------------------------------------------
    // UNLOCK ACTION — for SOFT boxes only
    // --------------------------------------------------------
    if (action === "unlock") {
      // KEYHOLDER must go through the unlock-request flow — not self-unlockable
      if (box.lockType === "KEYHOLDER") {
        return NextResponse.json(
          {
            error:
              "KEYHOLDER boxes cannot be self-unlocked. Submit an unlock request.",
          },
          { status: 400 },
        );
      }

      // Sprint 6 — HARD boxes can be self-unlocked by the user, but a reason is required.
      // SOFT boxes unlock with confirmation only (no reason needed).
      const reason: string | undefined = body.reason;
      if (box.lockType === "HARD") {
        if (!reason || !reason.trim()) {
          return NextResponse.json(
            { error: "A reason is required to unlock a HARD box." },
            { status: 400 },
          );
        }
      }

      const unlockedBox = await prisma.box.update({
        where: { id },
        data: {
          status: box.lockType === "SOFT" ? "CREATED" : "UNLOCKED",
          lockUntil: null,
          lockedAmount: 0,
        },
      });

      // Record the self-unlock action on the activity feed
      await prisma.transaction.create({
        data: {
          userId: session.user.id,
          boxId: box.id,
          type: "UNLOCK",
          amount: 0,
          description:
            box.lockType === "HARD"
              ? `Self-unlocked (HARD): ${reason!.trim()}`
              : `Unlocked ${box.name}`,
        },
      });

      return NextResponse.json(unlockedBox);
    }
    // --------------------------------------------------------
    // GENERAL UPDATE — name, description, targetAmount
    // --------------------------------------------------------
    const validLockTypes = ["HARD", "SOFT", "KEYHOLDER"];

    // Sprint 7 — due date edits only allowed on SOFT, non-wallet boxes.
    // HARD/KEYHOLDER lockUntil can only be set via the lock action at creation/lock time.
    if (lockUntil !== undefined) {
      if (box.isWallet) {
        return NextResponse.json({ error: "Wallet has no due date." }, { status: 400 });
      }
      if (box.lockType !== "SOFT") {
        return NextResponse.json(
          { error: "Only Flexible (SOFT) boxes can edit the due date." },
          { status: 400 },
        );
      }
      if (lockUntil !== null && new Date(lockUntil) <= new Date()) {
        return NextResponse.json(
          { error: "lockUntil must be a future date." },
          { status: 400 },
        );
      }
    }

    const updatedBox = await prisma.box.update({
      where: { id: id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(targetAmount !== undefined && {
          targetAmount: targetAmount ? Math.round(targetAmount * 100) : null,
        }),
        ...(lockType && validLockTypes.includes(lockType) && { lockType }),
        ...(lockUntil !== undefined && {
          lockUntil: lockUntil ? new Date(lockUntil) : null,
        }),
      },
    });

    return NextResponse.json(updatedBox);
  } catch (error) {
    console.error("[PATCH /api/boxes/:id]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ------------------------------------------------------------
// DELETE — close a box (sets status to CLOSED)
// Hard delete is not allowed — we keep the record for audit trail
// ------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const box = await prisma.box.findUnique({
      where: { id: id },
    });

    if (!box) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    if (box.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Sprint 4 — Wallet cannot be closed
    if (box.isWallet) {
      return NextResponse.json(
        { error: "The Wallet cannot be closed." },
        { status: 400 },
      );
    }

    if (box.isClosed) {
      return NextResponse.json({ error: "Box is already closed" }, { status: 400 });
    }

    // Sprint 4 close conditions — collect ALL blockers so UI can show a precise modal
    const blockers: string[] = [];
    if (box.lockedAmount > 0) blockers.push("locked_amount");
    if (box.status === BOX_STATUS.LOCKED || box.status === BOX_STATUS.UNLOCK_PENDING) {
      blockers.push("status_locked");
    }
    const pendingUnlock = await prisma.unlockRequest.findFirst({
      where: { boxId: box.id, status: "PENDING" },
      select: { id: true },
    });
    if (pendingUnlock) blockers.push("pending_unlock");
    const activeKeyholder = await prisma.keyholderRelationshipBox.findFirst({
      where: { boxId: box.id, relationship: { status: "ACTIVE" } },
      select: { id: true },
    });
    if (activeKeyholder) blockers.push("active_keyholder");

    if (blockers.length > 0) {
      return NextResponse.json(
        {
          error: "Box cannot be closed yet",
          blockers,
          balance: box.balance / 100,
          lockedAmount: box.lockedAmount / 100,
          available: (box.balance - box.lockedAmount) / 100,
        },
        { status: 400 },
      );
    }

    // Ensure the Wallet exists for sweep destination (defensive — lazy create)
    let wallet = await prisma.box.findFirst({
      where: { userId: session.user.id, isWallet: true },
    });
    if (!wallet) {
      wallet = await prisma.box.create({
        data: {
          userId: session.user.id,
          name: "Wallet",
          status: "CREATED",
          lockType: "SOFT",
          isWallet: true,
        },
      });
    }

    const available = box.balance - box.lockedAmount;

    // Sweep available to Wallet, mark box closed, record transactions
    await prisma.$transaction(async (tx) => {
      if (available > 0) {
        await tx.box.update({
          where: { id: box.id },
          data: { balance: { decrement: available } },
        });
        await tx.box.update({
          where: { id: wallet!.id },
          data: { balance: { increment: available } },
        });
        await tx.transaction.createMany({
          data: [
            {
              userId: session.user.id,
              boxId: box.id,
              type: "TRANSFER_OUT",
              amount: available,
              description: `Box closed — swept to Wallet`,
            },
            {
              userId: session.user.id,
              boxId: wallet!.id,
              type: "TRANSFER_IN",
              amount: available,
              description: `From closed box: ${box.name}`,
            },
          ],
        });
      }
      await tx.box.update({
        where: { id: box.id },
        data: { isClosed: true },
      });
    });

    return NextResponse.json({
      ok: true,
      sweptToWallet: available / 100,
      walletId: wallet.id,
    });
  } catch (error) {
    console.error("[DELETE /api/boxes/:id]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
