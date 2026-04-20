// ============================================================
// app/api/card/simulate/route.ts
// POST /api/card/simulate — simulated card spend (all users)
// ============================================================
// Sprint 12: card spends from Wallet only. If the Wallet has the funds,
// debit it and write a WITHDRAW Transaction. If not, DECLINE — no money
// moves, and the decline is logged as an AuditEvent only (per board decision).
// No DECLINED Transaction type; ledger stays clean.
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

    const body = await req.json().catch(() => ({}));
    const amtDollars = Number(body?.amountInDollars);
    const merchantRaw = typeof body?.merchant === "string" ? body.merchant.trim() : "";
    const merchant = merchantRaw || "Unknown merchant";

    if (!Number.isFinite(amtDollars) || amtDollars < 0.01) {
      return NextResponse.json(
        { error: "amountInDollars must be at least $0.01" },
        { status: 400 },
      );
    }

    // Lazy-backfill wallet just like /api/boxes does.
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

    const amtCents = Math.round(amtDollars * 100);

    // ── Decline path ─────────────────────────────────────────
    // Per board decision: no Transaction record for declines.
    // AuditEvent only so the ledger + activity feed stay clean.
    if (wallet.balance < amtCents) {
      await prisma.auditEvent.create({
        data: {
          actor: "USER",
          actorId: session.user.id,
          action: "CARD_DECLINED",
          targetId: wallet.id,
          metadata: JSON.stringify({
            merchant,
            amountCents: amtCents,
            walletBalance: wallet.balance,
          }),
        },
      });
      return NextResponse.json({
        approved: false,
        amountCents: amtCents,
        walletBalance: wallet.balance,
        reason: "insufficient_wallet_balance",
      });
    }

    // ── Approved path ────────────────────────────────────────
    const [, txRow] = await prisma.$transaction([
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
          description: `Card purchase — ${merchant}`,
        },
      }),
    ]);

    return NextResponse.json({
      approved: true,
      amountCents: amtCents,
      newWalletBalance: wallet.balance - amtCents,
      transactionId: txRow.id,
    });
  } catch (error) {
    console.error("[POST /api/card/simulate]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
