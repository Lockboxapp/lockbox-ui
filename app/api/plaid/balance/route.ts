// ============================================================
// app/api/plaid/balance/route.ts
// GET — current bank balance for the signed-in user from Plaid.
// Returns the highest-balance depository account (typically checking).
// Sprint 17 (Phase 2 — phase2 branch only).
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPlaidClient } from "@/lib/plaid/client";
import { decrypt } from "@/lib/encryption";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const item = await prisma.plaidItem.findUnique({
      where: { userId: session.user.id },
    });
    if (!item) {
      return NextResponse.json({ connected: false });
    }

    const plaid = getPlaidClient();
    const accessToken = decrypt(item.accessToken);
    const balRes = await plaid.accountsBalanceGet({
      access_token: accessToken,
    });

    // Pick the highest-available-balance depository account.
    const accounts = balRes.data.accounts.filter(
      (a) => a.type === "depository",
    );
    const ranked = accounts.sort(
      (a, b) =>
        (b.balances.available ?? b.balances.current ?? 0) -
        (a.balances.available ?? a.balances.current ?? 0),
    );
    const account = ranked[0] ?? balRes.data.accounts[0];

    if (!account) {
      return NextResponse.json({
        connected: true,
        institution: item.institution,
        balanceCents: null,
        accountName: null,
      });
    }

    const dollars =
      account.balances.available ?? account.balances.current ?? 0;
    return NextResponse.json({
      connected: true,
      institution: item.institution,
      accountName: account.name ?? account.official_name ?? "Account",
      balanceCents: Math.round(dollars * 100),
    });
  } catch (err) {
    console.error("[GET /api/plaid/balance]", err);
    return NextResponse.json(
      { error: "Failed to fetch balance" },
      { status: 500 },
    );
  }
}
