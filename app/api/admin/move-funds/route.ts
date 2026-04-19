// ============================================================
// app/api/admin/move-funds/route.ts
// POST /api/admin/move-funds — ADMIN-ONLY manual money movement
// ============================================================
// Writes paired TRANSFER_OUT / TRANSFER_IN transactions and an
// AuditEvent with actor=ADMIN. Does NOT bypass ownership checks:
// both boxes must belong to the same user.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { fromBoxId, toBoxId, amountInDollars, reason } = body;

    if (!fromBoxId || !toBoxId) {
      return NextResponse.json({ error: "fromBoxId and toBoxId required" }, { status: 400 });
    }
    if (fromBoxId === toBoxId) {
      return NextResponse.json({ error: "Cannot move to the same box" }, { status: 400 });
    }
    const amt = Number(amountInDollars);
    if (!Number.isFinite(amt) || amt < 1) {
      return NextResponse.json({ error: "amountInDollars must be at least $1" }, { status: 400 });
    }
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }

    const [fromBox, toBox] = await Promise.all([
      prisma.box.findUnique({ where: { id: fromBoxId } }),
      prisma.box.findUnique({ where: { id: toBoxId } }),
    ]);
    if (!fromBox || !toBox) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }
    if (fromBox.userId !== toBox.userId) {
      return NextResponse.json(
        { error: "Both boxes must belong to the same user" },
        { status: 400 },
      );
    }

    const amtCents = Math.round(amt * 100);
    if (fromBox.balance < amtCents) {
      return NextResponse.json({ error: "Insufficient source balance" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.box.update({
        where: { id: fromBoxId },
        data: { balance: { decrement: amtCents } },
      });
      await tx.box.update({
        where: { id: toBoxId },
        data: { balance: { increment: amtCents } },
      });
      await tx.transaction.createMany({
        data: [
          {
            userId: fromBox.userId,
            boxId: fromBoxId,
            type: "TRANSFER_OUT",
            amount: amtCents,
            description: `Admin move-funds to ${toBox.name} — ${reason.trim()}`,
          },
          {
            userId: toBox.userId,
            boxId: toBoxId,
            type: "TRANSFER_IN",
            amount: amtCents,
            description: `Admin move-funds from ${fromBox.name} — ${reason.trim()}`,
          },
        ],
      });
      await tx.auditEvent.create({
        data: {
          actor: "ADMIN",
          actorId: session.user.id,
          action: "ADMIN_MOVE_FUNDS",
          targetId: fromBoxId,
          metadata: JSON.stringify({
            fromBoxId,
            toBoxId,
            amountCents: amtCents,
            reason: reason.trim(),
            affectedUserId: fromBox.userId,
          }),
        },
      });
    });

    const [updatedFrom, updatedTo] = await Promise.all([
      prisma.box.findUnique({ where: { id: fromBoxId }, select: { balance: true } }),
      prisma.box.findUnique({ where: { id: toBoxId }, select: { balance: true } }),
    ]);

    return NextResponse.json({
      ok: true,
      fromBalance: (updatedFrom?.balance ?? 0) / 100,
      toBalance: (updatedTo?.balance ?? 0) / 100,
    });
  } catch (err) {
    console.error("[POST /api/admin/move-funds]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
