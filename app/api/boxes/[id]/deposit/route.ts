// ============================================================
// app/api/boxes/[id]/deposit/route.ts
// POST /api/boxes/:id/deposit — fund a safe deposit box
// In sandbox: uses Unit simulation endpoint directly
// In production: uses Plaid linked account + ACH pull
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { simulateSandboxDeposit } from "@/lib/unit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    if (!box.unitAccountId) {
      return NextResponse.json(
        { error: "Box does not have a Unit account yet" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { amountInDollars } = body;

    if (!amountInDollars || amountInDollars < 1) {
      return NextResponse.json(
        { error: "amountInDollars is required and must be at least $1" },
        { status: 400 }
      );
    }

    const amountInCents = Math.round(amountInDollars * 100);

    // Simulate deposit in sandbox
    const result = await simulateSandboxDeposit({
      unitAccountId: box.unitAccountId,
      amountInCents,
    });

    // Record transaction in our DB
    await prisma.transaction.create({
      data: {
        userId: session.user.id,
        boxId: box.id,
        type: "DEPOSIT",
        amount: amountInCents,
        description: `Deposit to ${box.name}`,
      },
    });

    // Update box balance in our DB
    await prisma.box.update({
      where: { id: box.id },
      data: { balance: { increment: amountInCents } },
    });

    return NextResponse.json({
      ok: true,
      newBalance: result.data.attributes.balance,
      amount: amountInCents,
    });
  } catch (error: any) {
    console.error("[POST /api/boxes/:id/deposit]", error);
    return NextResponse.json(
      { error: error.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
