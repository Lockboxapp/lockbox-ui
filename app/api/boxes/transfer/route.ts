// ============================================================
// app/api/boxes/transfer/route.ts
// POST /api/boxes/transfer
// ============================================================
// LOCK ENFORCEMENT — server-side, cannot be bypassed.
// Applies to the SOURCE box ONLY. Transfer IN is always allowed
// regardless of destination lockType (Sprint 14 Bug 1 board rule).
// Destination lockType determines what happens to funds after
// they arrive — not whether the transfer is allowed.
//
// Source rules:
//   HARD      → blocked when status = LOCKED; must unlock first
//   KEYHOLDER → blocked when status = LOCKED; keyholder must approve
//   SOFT      → blocked when status = LOCKED; must self-unlock first
//   CREATED, FUNDING, UNLOCKED → allowed for any lockType
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const TRANSFERABLE_STATUSES = ["CREATED", "FUNDING", "UNLOCKED"];

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { fromBoxId, toBoxId, amountInDollars } = body;

    const amtNum = Number(amountInDollars);
    if (!fromBoxId || !toBoxId || !Number.isFinite(amtNum) || amtNum < 1) {
      return NextResponse.json(
        { error: "fromBoxId, toBoxId, and amountInDollars (min $1) are required" },
        { status: 400 },
      );
    }

    if (fromBoxId === toBoxId) {
      return NextResponse.json(
        { error: "Cannot transfer to the same box" },
        { status: 400 },
      );
    }

    // Load both boxes
    const [fromBox, toBox] = await Promise.all([
      prisma.box.findUnique({ where: { id: fromBoxId } }),
      prisma.box.findUnique({ where: { id: toBoxId } }),
    ]);

    if (!fromBox || !toBox) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    // Ownership check
    if (fromBox.userId !== session.user.id || toBox.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── LOCK ENFORCEMENT ─────────────────────────────────────
    // Sprint 8 BUG-02 fix: gate on STATUS first, then lockType.
    // UNLOCKED boxes can always transfer regardless of lockType (board decision).

    if (fromBox.status === "UNLOCKED") {
      // Allow — box was explicitly unlocked via self-unlock or keyholder approval.
    } else if (fromBox.lockType === "HARD" && fromBox.status === "LOCKED") {
      return NextResponse.json(
        {
          error: "This box is fully locked.",
          locked: true,
          lockType: "HARD",
          message: "Unlock this box first, then transfer.",
        },
        { status: 403 },
      );
    } else if (fromBox.lockType === "KEYHOLDER" && fromBox.status === "LOCKED") {
      return NextResponse.json(
        {
          error: "Keyholder approval required.",
          locked: true,
          lockType: "KEYHOLDER",
          message: "Your keyholder must approve a transfer from this box.",
        },
        { status: 403 },
      );
    } else if (!TRANSFERABLE_STATUSES.includes(fromBox.status)) {
      return NextResponse.json(
        {
          error: "This box cannot be used as a transfer source right now.",
          message:
            fromBox.status === "LOCKED"
              ? "Unlock this box first, then transfer."
              : `Box status is ${fromBox.status}.`,
        },
        { status: 403 },
      );
    }

    const amountInCents = Math.round(amtNum * 100);
    // Partial-lock enforcement via lockedAmount (SOFT source of truth)
    const available = fromBox.balance - fromBox.lockedAmount;

    if (amountInCents > available) {
      return NextResponse.json(
        {
          error: "Amount exceeds available (unlocked) balance in source box",
          message: `$${(available / 100).toLocaleString()} is available. The rest is locked.`,
          available: available / 100,
        },
        { status: 400 },
      );
    }

    // Execute transfer
    const [updatedFrom] = await prisma.$transaction([
      prisma.box.update({
        where: { id: fromBoxId },
        data: { balance: { decrement: amountInCents } },
      }),
      prisma.box.update({
        where: { id: toBoxId },
        data: { balance: { increment: amountInCents } },
      }),
      prisma.transaction.create({
        data: {
          userId: session.user.id,
          boxId: fromBoxId,
          type: "TRANSFER_OUT",
          amount: amountInCents,
          description: `Transfer to ${toBox.name}`,
        },
      }),
      prisma.transaction.create({
        data: {
          userId: session.user.id,
          boxId: toBoxId,
          type: "TRANSFER_IN",
          amount: amountInCents,
          description: `Transfer from ${fromBox.name}`,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      fromBalance: updatedFrom.balance / 100,
      amount: amtNum,
    });
  } catch (error) {
    console.error("[POST /api/boxes/transfer]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
