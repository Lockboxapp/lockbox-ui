// ============================================================
// app/api/boxes/[id]/withdraw/route.ts
// POST /api/boxes/:id/withdraw
// ============================================================
// LOCK ENFORCEMENT — server-side, cannot be bypassed:
//   HARD      → blocked, must go through unlock request flow
//   KEYHOLDER → blocked, must submit unlock request for approval
//   SOFT      → allowed (frontend adds confirmation friction)
// Deposits are always allowed regardless of lockType.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const box = await prisma.box.findUnique({ where: { id } });

    if (!box) {
      return NextResponse.json({ error: "Box not found" }, { status: 404 });
    }

    if (box.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── LOCK ENFORCEMENT ─────────────────────────────────────
    // Backend is source of truth — no frontend bypass possible

    if (box.lockType === "HARD") {
      return NextResponse.json(
        {
          error: "This box is fully locked.",
          locked: true,
          lockType: "HARD",
          message: "Submit an unlock request to access these funds.",
        },
        { status: 403 },
      );
    }

    if (box.lockType === "KEYHOLDER") {
      return NextResponse.json(
        {
          error: "Keyholder approval required.",
          locked: true,
          lockType: "KEYHOLDER",
          message:
            "Submit an unlock request. Your keyholder must approve before funds are released.",
        },
        { status: 403 },
      );
    }

    // SOFT — allowed, frontend handles friction
    const body = await req.json();
    const { amountInDollars } = body;

    if (!amountInDollars || amountInDollars < 1) {
      return NextResponse.json(
        { error: "amountInDollars must be at least $1" },
        { status: 400 },
      );
    }

    const amountInCents = Math.round(amountInDollars * 100);

    if (box.balance < amountInCents) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 },
      );
    }

    const [updatedBox] = await prisma.$transaction([
      prisma.box.update({
        where: { id: box.id },
        data: { balance: { decrement: amountInCents } },
      }),
      prisma.transaction.create({
        data: {
          userId: session.user.id,
          boxId: box.id,
          type: "WITHDRAW",
          amount: amountInCents,
          description: `Withdrawal from ${box.name}`,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      newBalance: updatedBox.balance / 100,
      amount: amountInCents / 100,
    });
  } catch (error) {
    console.error("[POST /api/boxes/:id/withdraw]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
