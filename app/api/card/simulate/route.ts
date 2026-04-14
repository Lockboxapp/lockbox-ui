// ============================================================
// app/api/card/simulate/route.ts
// POST /api/card/simulate — ADMIN ONLY simulated card spend
// ============================================================
// Debits the user's Wallet and records a WITHDRAW transaction.
// No real card processor is contacted. Visible only to admins.
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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });

    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const body = await req.json();
    const amtDollars = Number(body?.amountInDollars);
    if (!Number.isFinite(amtDollars) || amtDollars < 1) {
      return NextResponse.json(
        { error: "amountInDollars must be at least $1" },
        { status: 400 },
      );
    }

    const wallet = await prisma.box.findFirst({
      where: { userId: session.user.id, isWallet: true },
    });
    if (!wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    const amtCents = Math.round(amtDollars * 100);
    if (wallet.balance < amtCents) {
      return NextResponse.json(
        { error: "Insufficient Wallet balance" },
        { status: 400 },
      );
    }

    await prisma.$transaction([
      prisma.box.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amtCents } },
      }),
      prisma.transaction.create({
        data: {
          userId: session.user.id,
          boxId: wallet.id,
          type: "WITHDRAW",
          amount: amtCents,
          description: "Card spend (simulated)",
        },
      }),
    ]);

    return NextResponse.json({ ok: true, newWalletBalance: (wallet.balance - amtCents) / 100 });
  } catch (error) {
    console.error("[POST /api/card/simulate]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
